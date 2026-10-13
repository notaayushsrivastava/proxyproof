import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from backend.app.models.device import Device, DeviceChangeRequest
from backend.app.models.enums import DevicePlatform, DeviceStatus, DeviceRequestStatus
from backend.app.services.audit_service import log_audit_event


def register_device(
    db: Session,
    user_id: uuid.UUID,
    platform: DevicePlatform,
    public_key: Optional[str] = None,
    device_label: Optional[str] = None,
) -> Device:
    """
    Registers a device. If the student has no active device, activates it immediately.
    If an active device already exists, marks the new device as PENDING approval.
    """
    existing_active = (
        db.query(Device)
        .filter(Device.user_id == user_id, Device.status == DeviceStatus.ACTIVE)
        .first()
    )

    assigned_status = DeviceStatus.ACTIVE if existing_active is None else DeviceStatus.PENDING

    now = datetime.now(timezone.utc)
    device = Device(
        id=uuid.uuid4(),
        user_id=user_id,
        platform=platform,
        public_key=public_key,
        device_label=device_label or ("Primary Device" if assigned_status == DeviceStatus.ACTIVE else "Secondary Device"),
        status=assigned_status,
        registered_at=now,
        last_seen_at=now,
    )
    db.add(device)
    db.flush()

    log_audit_event(
        db=db,
        actor_id=user_id,
        action="DEVICE_REGISTERED",
        target_type="device",
        target_id=str(device.id),
        reason="First device auto-activated" if assigned_status == DeviceStatus.ACTIVE else "Device registered as pending",
        metadata_json={"status": assigned_status.value, "platform": platform.value},
    )
    db.commit()
    db.refresh(device)
    return device


def request_device_change(
    db: Session,
    student_id: uuid.UUID,
    new_device_id: uuid.UUID,
    reason: Optional[str] = None,
) -> DeviceChangeRequest:
    """Creates a device change request from pending device to replace existing active device."""
    new_device = (
        db.query(Device)
        .filter(Device.id == new_device_id, Device.user_id == student_id)
        .first()
    )
    if not new_device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="New device not found or does not belong to you",
        )
    if new_device.status == DeviceStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This device is already active",
        )

    # Locate current active device
    active_device = (
        db.query(Device)
        .filter(Device.user_id == student_id, Device.status == DeviceStatus.ACTIVE)
        .first()
    )

    change_req = DeviceChangeRequest(
        id=uuid.uuid4(),
        student_id=student_id,
        old_device_id=active_device.id if active_device else None,
        new_device_id=new_device.id,
        status=DeviceRequestStatus.PENDING,
        reason=reason,
    )
    db.add(change_req)
    db.flush()

    log_audit_event(
        db=db,
        actor_id=student_id,
        action="DEVICE_CHANGE_REQUESTED",
        target_type="device_change_request",
        target_id=str(change_req.id),
        reason=reason,
        metadata_json={
            "old_device_id": str(active_device.id) if active_device else None,
            "new_device_id": str(new_device.id),
        },
    )
    db.commit()
    db.refresh(change_req)
    return change_req


def approve_device_change(
    db: Session,
    request_id: uuid.UUID,
    admin_id: uuid.UUID,
    reason: Optional[str] = None,
) -> DeviceChangeRequest:
    """Atomically activates the new device and revokes the previous device."""
    change_req = (
        db.query(DeviceChangeRequest)
        .filter(DeviceChangeRequest.id == request_id)
        .first()
    )
    if not change_req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if change_req.status != DeviceRequestStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Request is already {change_req.status.value}",
        )

    now = datetime.now(timezone.utc)

    # 1. Revoke old device if present and flush immediately to free the partial unique index
    if change_req.old_device_id:
        old_device = db.query(Device).filter(Device.id == change_req.old_device_id).first()
        if old_device:
            old_device.status = DeviceStatus.REVOKED
            old_device.revoked_at = now
            db.flush()

    # 2. Activate new device
    new_device = db.query(Device).filter(Device.id == change_req.new_device_id).first()
    if not new_device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target device not found")
    new_device.status = DeviceStatus.ACTIVE
    new_device.revoked_at = None
    db.flush()

    # 3. Update request
    change_req.status = DeviceRequestStatus.APPROVED
    change_req.reviewed_by = admin_id
    change_req.reviewed_at = now
    if reason:
        change_req.reason = reason

    log_audit_event(
        db=db,
        actor_id=admin_id,
        action="DEVICE_CHANGE_APPROVED",
        target_type="device_change_request",
        target_id=str(change_req.id),
        reason=reason,
        metadata_json={
            "student_id": str(change_req.student_id),
            "old_device_id": str(change_req.old_device_id) if change_req.old_device_id else None,
            "new_device_id": str(change_req.new_device_id),
        },
    )
    db.commit()
    db.refresh(change_req)
    return change_req


def reject_device_change(
    db: Session,
    request_id: uuid.UUID,
    admin_id: uuid.UUID,
    reason: Optional[str] = None,
) -> DeviceChangeRequest:
    """Rejects device change request; existing active device remains untouched."""
    change_req = (
        db.query(DeviceChangeRequest)
        .filter(DeviceChangeRequest.id == request_id)
        .first()
    )
    if not change_req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if change_req.status != DeviceRequestStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Request is already {change_req.status.value}",
        )

    now = datetime.now(timezone.utc)
    change_req.status = DeviceRequestStatus.REJECTED
    change_req.reviewed_by = admin_id
    change_req.reviewed_at = now
    if reason:
        change_req.reason = reason

    log_audit_event(
        db=db,
        actor_id=admin_id,
        action="DEVICE_CHANGE_REJECTED",
        target_type="device_change_request",
        target_id=str(change_req.id),
        reason=reason,
        metadata_json={"student_id": str(change_req.student_id)},
    )
    db.commit()
    db.refresh(change_req)
    return change_req
