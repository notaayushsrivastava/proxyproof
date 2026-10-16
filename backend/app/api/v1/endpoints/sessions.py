import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.core.dependencies import get_current_user, get_current_organizer, get_current_student
from backend.app.models import (
    User,
    Class,
    ClassMembership,
    AttendanceSession,
    AttendanceRecord,
    StudentProfile,
)
from backend.app.models.enums import SessionStatus, UserRole
from backend.app.schemas.session import (
    SessionCreate,
    SessionResponse,
    OrganizerSessionStartResponse,
    ActiveSessionStudentView,
)
from backend.app.schemas.attendance import AttendanceRecordResponse
from backend.app.services.class_service import verify_organizer_class_access
from backend.app.services.export_service import generate_attendance_csv
from backend.app.services.audit_service import log_audit_event
from backend.app.core.config import settings
from backend.app.core.security import generate_hmac_proof
from backend.app.services.websocket_manager import ws_manager

router = APIRouter()


@router.post("/classes/{class_id}/sessions", response_model=OrganizerSessionStartResponse, status_code=status.HTTP_201_CREATED)
def start_session(
    class_id: uuid.UUID,
    payload: SessionCreate,
    current_organizer: User = Depends(get_current_organizer),
    db: Session = Depends(get_db),
):
    """
    Organizer creates an active session. Generates high-entropy 256-bit secret,
    computes authoritative server expiry, and returns organizer-only beacon credentials.
    """
    target_class = verify_organizer_class_access(db=db, class_id=class_id, user=current_organizer)

    now = datetime.now(timezone.utc)
    ends_at = now + timedelta(minutes=payload.duration_minutes)

    # Automatically expire any lingering open sessions for this organizer in this class
    active_previous = (
        db.query(AttendanceSession)
        .filter(
            AttendanceSession.class_id == class_id,
            AttendanceSession.organizer_id == current_organizer.id,
            AttendanceSession.status == SessionStatus.ACTIVE,
        )
        .all()
    )
    for old_s in active_previous:
        old_s.status = SessionStatus.CLOSED
        old_s.closed_at = now

    # High-entropy 256-bit session secret
    session_secret_hex = os.urandom(32).hex()

    new_session = AttendanceSession(
        id=uuid.uuid4(),
        class_id=class_id,
        organizer_id=current_organizer.id,
        status=SessionStatus.ACTIVE,
        started_at=now,
        ends_at=ends_at,
        beacon_secret_ciphertext=session_secret_hex,
        protocol_version=1,
        notes=payload.notes,
        proximity_threshold=payload.proximity_threshold,
    )
    db.add(new_session)
    db.flush()

    log_audit_event(
        db=db,
        actor_id=current_organizer.id,
        action="SESSION_STARTED",
        target_type="attendance_session",
        target_id=str(new_session.id),
        metadata_json={
            "class_id": str(class_id),
            "duration_minutes": payload.duration_minutes,
            "ends_at": ends_at.isoformat(),
        },
    )
    db.commit()
    db.refresh(new_session)

    return OrganizerSessionStartResponse(
        id=new_session.id,
        class_id=new_session.class_id,
        organizer_id=new_session.organizer_id,
        status=new_session.status,
        started_at=new_session.started_at,
        ends_at=new_session.ends_at,
        closed_at=new_session.closed_at,
        protocol_version=new_session.protocol_version,
        notes=new_session.notes,
        proximity_threshold=new_session.proximity_threshold,
        session_secret=session_secret_hex,
        proof_validity_seconds=5,
    )


@router.get("/sessions/active", response_model=List[ActiveSessionStudentView])
def get_active_sessions_for_student(
    current_student: User = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """
    Returns active sessions for classes in which the student is enrolled.
    Secrets are never exposed to students.
    """
    now = datetime.now(timezone.utc)

    # Reconcile expired sessions
    expired_sessions = (
        db.query(AttendanceSession)
        .filter(AttendanceSession.status == SessionStatus.ACTIVE, AttendanceSession.ends_at <= now)
        .all()
    )
    for s in expired_sessions:
        s.status = SessionStatus.EXPIRED
    if expired_sessions:
        db.commit()

    active_sessions = (
        db.query(AttendanceSession, Class)
        .join(Class, AttendanceSession.class_id == Class.id)
        .join(ClassMembership, ClassMembership.class_id == Class.id)
        .filter(
            ClassMembership.student_id == current_student.id,
            AttendanceSession.status == SessionStatus.ACTIVE,
            AttendanceSession.ends_at > now,
        )
        .all()
    )

    results = []
    current_time_slot = int(now.timestamp() // settings.PROOF_VALIDITY_SECONDS)
    for sess, cls in active_sessions:
        token = None
        if settings.ENVIRONMENT == "development" and sess.beacon_secret_ciphertext:
            token = generate_hmac_proof(
                session_secret_hex=sess.beacon_secret_ciphertext,
                session_id=sess.id,
                time_slot=current_time_slot,
                protocol_version=sess.protocol_version,
            )
        results.append(
            ActiveSessionStudentView(
                id=sess.id,
                class_id=sess.class_id,
                class_name=cls.name,
                class_code=cls.code,
                started_at=sess.started_at,
                ends_at=sess.ends_at,
                proximity_threshold=sess.proximity_threshold,
                protocol_version=sess.protocol_version,
                current_token=token,
                current_time_slot=current_time_slot if token else None,
            )
        )
    return results


@router.get("/sessions/{session_id}", response_model=SessionResponse)
def get_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns session details with server time expiry reconciliation."""
    sess = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    now = datetime.now(timezone.utc)
    if sess.status == SessionStatus.ACTIVE and now >= sess.ends_at:
        sess.status = SessionStatus.EXPIRED
        db.commit()
        db.refresh(sess)

    return sess


@router.post("/sessions/{session_id}/close", response_model=SessionResponse)
async def close_session(
    session_id: uuid.UUID,
    current_organizer: User = Depends(get_current_organizer),
    db: Session = Depends(get_db),
):
    """Organizer terminates session early. Stops accepting marks immediately."""
    sess = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if current_organizer.role != UserRole.ADMIN and sess.organizer_id != current_organizer.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")

    now = datetime.now(timezone.utc)
    sess.status = SessionStatus.CLOSED
    sess.closed_at = now

    log_audit_event(
        db=db,
        actor_id=current_organizer.id,
        action="SESSION_CLOSED",
        target_type="attendance_session",
        target_id=str(session_id),
        metadata_json={"closed_at": now.isoformat()},
    )
    db.commit()
    db.refresh(sess)

    await ws_manager.broadcast_session_event(
        session_id=session_id,
        event_type="session.closed",
        data={"sessionId": str(session_id), "status": "closed", "closedAt": now.isoformat()},
    )
    return sess


@router.get("/sessions/{session_id}/attendance", response_model=List[AttendanceRecordResponse])
def get_session_attendance(
    session_id: uuid.UUID,
    current_organizer: User = Depends(get_current_organizer),
    db: Session = Depends(get_db),
):
    """Returns attendance records for an organizer's session."""
    sess = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if current_organizer.role != UserRole.ADMIN and sess.organizer_id != current_organizer.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")

    records = (
        db.query(AttendanceRecord, User, StudentProfile)
        .join(User, AttendanceRecord.student_id == User.id)
        .outerjoin(StudentProfile, StudentProfile.user_id == User.id)
        .filter(AttendanceRecord.session_id == session_id)
        .order_by(AttendanceRecord.marked_at.desc())
        .all()
    )

    out = []
    for rec, student, profile in records:
        out.append(
            AttendanceRecordResponse(
                id=rec.id,
                session_id=rec.session_id,
                student_id=rec.student_id,
                student_name=student.full_name,
                student_email=student.email,
                student_number=profile.student_number if profile else None,
                status=rec.status,
                source=rec.source,
                marked_at=rec.marked_at,
                marked_by=rec.marked_by,
                reason=rec.reason,
            )
        )
    return out


@router.get("/sessions/{session_id}/export.csv")
def export_session_attendance_csv(
    session_id: uuid.UUID,
    current_organizer: User = Depends(get_current_organizer),
    db: Session = Depends(get_db),
):
    """Exports session attendance as a safe CSV file."""
    sess = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if current_organizer.role != UserRole.ADMIN and sess.organizer_id != current_organizer.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")

    cls = db.query(Class).filter(Class.id == sess.class_id).first()
    records = (
        db.query(AttendanceRecord, User, StudentProfile)
        .join(User, AttendanceRecord.student_id == User.id)
        .outerjoin(StudentProfile, StudentProfile.user_id == User.id)
        .filter(AttendanceRecord.session_id == session_id)
        .all()
    )

    csv_data = []
    for rec, student, profile in records:
        csv_data.append({
            "session_id": str(sess.id),
            "student_id": str(student.id),
            "student_name": student.full_name,
            "student_number": profile.student_number if profile else "",
            "student_email": student.email,
            "status": rec.status.value,
            "source": rec.source.value,
            "marked_at": rec.marked_at.isoformat(),
            "reason": rec.reason or "",
        })

    csv_text = generate_attendance_csv(
        records=csv_data,
        class_name=cls.name if cls else "Unknown",
        class_code=cls.code if cls else "Unknown",
    )

    filename = f"attendance_{cls.code if cls else 'session'}_{sess.started_at.strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=\"{filename}\""},
    )
