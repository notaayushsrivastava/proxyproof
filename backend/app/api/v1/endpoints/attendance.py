import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.core.dependencies import get_current_student, get_current_organizer
from backend.app.models import User, AttendanceSession, AttendanceRecord, ClassMembership
from backend.app.models.enums import AttendanceStatus, AttendanceSource, SessionStatus
from backend.app.schemas.attendance import (
    AttendanceAttemptRequest,
    AttendanceAttemptResponse,
    ManualAttendanceRequest,
    AttendanceRecordResponse,
)
from backend.app.services.attendance_validator import validate_and_record_attendance
from backend.app.services.audit_service import log_audit_event
from backend.app.services.websocket_manager import ws_manager

router = APIRouter()


@router.post("/sessions/{session_id}/attendance-attempts", response_model=AttendanceAttemptResponse)
async def submit_attendance_attempt(
    session_id: uuid.UUID,
    payload: AttendanceAttemptRequest,
    current_student: User = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """
    Authenticated student submits fresh BLE proof and proximity metadata.
    Validates token freshness, enrolled status, active device, and proximity threshold.
    """
    result = await validate_and_record_attendance(
        db=db,
        student=current_student,
        session_id=session_id,
        proof=payload.proof,
        client_time_slot=payload.time_slot,
        request_id=payload.request_id,
        rssi_median=payload.rssi_median,
        rssi_samples=payload.rssi_samples,
    )

    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "outcome_code": result.outcome_code,
                "message": result.message,
                "session_id": str(session_id),
                "student_id": str(current_student.id),
            },
        )

    return AttendanceAttemptResponse(
        outcome_code=result.outcome_code,
        message=result.message,
        session_id=session_id,
        student_id=current_student.id,
        status=result.record.status if result.record else AttendanceStatus.PRESENT,
        marked_at=result.record.marked_at if result.record else datetime.now(timezone.utc),
    )


@router.post("/sessions/{session_id}/attendance/manual", response_model=AttendanceRecordResponse, status_code=status.HTTP_201_CREATED)
async def manual_mark_attendance(
    session_id: uuid.UUID,
    payload: ManualAttendanceRequest,
    current_organizer: User = Depends(get_current_organizer),
    db: Session = Depends(get_db),
):
    """
    Organizer manually adds or updates an attendance mark with mandatory reason.
    Appends an immutable audit log.
    """
    sess = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if current_organizer.role.value != "admin" and sess.organizer_id != current_organizer.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")

    # Confirm student is enrolled
    membership = (
        db.query(ClassMembership)
        .filter(ClassMembership.class_id == sess.class_id, ClassMembership.student_id == payload.student_id)
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student is not enrolled in this class",
        )

    student = db.query(User).filter(User.id == payload.student_id).first()
    now = datetime.now(timezone.utc)

    # Check if record already exists
    record = (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.session_id == session_id, AttendanceRecord.student_id == payload.student_id)
        .first()
    )

    if record:
        record.status = payload.action
        record.source = AttendanceSource.MANUAL
        record.marked_at = now
        record.marked_by = current_organizer.id
        record.reason = payload.reason
    else:
        record = AttendanceRecord(
            id=uuid.uuid4(),
            session_id=session_id,
            student_id=payload.student_id,
            status=payload.action,
            source=AttendanceSource.MANUAL,
            marked_at=now,
            marked_by=current_organizer.id,
            reason=payload.reason,
        )
        db.add(record)

    log_audit_event(
        db=db,
        actor_id=current_organizer.id,
        action="ATTENDANCE_MANUAL_MARKED",
        target_type="attendance_record",
        target_id=str(record.id),
        reason=payload.reason,
        metadata_json={
            "session_id": str(session_id),
            "student_id": str(payload.student_id),
            "status": payload.action.value,
        },
    )
    db.commit()
    db.refresh(record)

    # Broadcast event
    await ws_manager.broadcast_session_event(
        session_id=session_id,
        event_type="attendance.corrected",
        data={
            "sessionId": str(session_id),
            "studentId": str(student.id),
            "studentName": student.full_name,
            "status": record.status.value,
            "source": "manual",
            "reason": payload.reason,
            "markedAt": record.marked_at.isoformat(),
        },
    )

    return AttendanceRecordResponse(
        id=record.id,
        session_id=record.session_id,
        student_id=record.student_id,
        student_name=student.full_name,
        student_email=student.email,
        status=record.status,
        source=record.source,
        marked_at=record.marked_at,
        marked_by=record.marked_by,
        reason=record.reason,
    )


@router.delete("/sessions/{session_id}/attendance/{student_id}", response_model=AttendanceRecordResponse)
async def remove_attendance_mark(
    session_id: uuid.UUID,
    student_id: uuid.UUID,
    reason: str,
    current_organizer: User = Depends(get_current_organizer),
    db: Session = Depends(get_db),
):
    """
    Organizer removes a student attendance mark. Preserves audit history by updating
    record status to REMOVED and logging the action.
    """
    sess = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if current_organizer.role.value != "admin" and sess.organizer_id != current_organizer.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")

    record = (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.session_id == session_id, AttendanceRecord.student_id == student_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance record not found")

    student = db.query(User).filter(User.id == student_id).first()
    record.status = AttendanceStatus.REMOVED
    record.marked_by = current_organizer.id
    record.reason = reason

    log_audit_event(
        db=db,
        actor_id=current_organizer.id,
        action="ATTENDANCE_RECORD_REMOVED",
        target_type="attendance_record",
        target_id=str(record.id),
        reason=reason,
        metadata_json={"session_id": str(session_id), "student_id": str(student_id)},
    )
    db.commit()
    db.refresh(record)

    await ws_manager.broadcast_session_event(
        session_id=session_id,
        event_type="attendance.removed",
        data={
            "sessionId": str(session_id),
            "studentId": str(student.id),
            "studentName": student.full_name,
            "status": "removed",
            "reason": reason,
        },
    )

    return AttendanceRecordResponse(
        id=record.id,
        session_id=record.session_id,
        student_id=record.student_id,
        student_name=student.full_name,
        student_email=student.email,
        status=record.status,
        source=record.source,
        marked_at=record.marked_at,
        marked_by=record.marked_by,
        reason=record.reason,
    )
