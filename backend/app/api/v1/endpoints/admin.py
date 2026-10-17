import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.core.dependencies import get_current_admin
from backend.app.models.user import User
from backend.app.models.device import DeviceChangeRequest
from backend.app.schemas.device import (
    DeviceChangeRequestResponse,
    DeviceApprovalAction,
)
from backend.app.services.device_service import approve_device_change, reject_device_change

router = APIRouter()


@router.get("/device-change-requests", response_model=List[DeviceChangeRequestResponse])
def list_device_change_requests(
    status_filter: Optional[str] = Query("pending", alias="status"),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Lists device change requests queued for admin approval, scoped to the admin's institution."""
    query = db.query(DeviceChangeRequest).join(User, DeviceChangeRequest.student_id == User.id)
    if current_admin.institution_id:
        query = query.filter(User.institution_id == current_admin.institution_id)
    if status_filter:
        query = query.filter(DeviceChangeRequest.status == status_filter)
    return query.order_by(DeviceChangeRequest.created_at.desc()).all()


@router.post("/device-change-requests/{request_id}/approve", response_model=DeviceChangeRequestResponse)
def approve_request(
    request_id: uuid.UUID,
    payload: Optional[DeviceApprovalAction] = None,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Atomically approves device change: activates new device and revokes old device."""
    return approve_device_change(
        db=db,
        request_id=request_id,
        admin_id=current_admin.id,
        reason=payload.reason if payload else None,
    )


@router.post("/device-change-requests/{request_id}/reject", response_model=DeviceChangeRequestResponse)
def reject_request(
    request_id: uuid.UUID,
    payload: Optional[DeviceApprovalAction] = None,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Rejects device change request; existing active device remains intact."""
    return reject_device_change(
        db=db,
        request_id=request_id,
        admin_id=current_admin.id,
        reason=payload.reason if payload else None,
    )
