from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.core.dependencies import get_current_student, get_current_user
from backend.app.models import User, Class, ClassMembership, AttendanceSession, AttendanceRecord
from backend.app.models.user import StudentProfile
from backend.app.models.enums import AttendanceStatus, SessionStatus, UserRole
from backend.app.schemas.attendance import (
    ClassAttendanceSummary,
    StudentAttendanceHistoryItem,
)
from backend.app.schemas.class_schema import StudentResponse

router = APIRouter()


@router.get("/students", response_model=List[StudentResponse])
def list_students(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lists students accessible to the organizer or administrator."""
    query = (
        db.query(User, StudentProfile)
        .outerjoin(StudentProfile, StudentProfile.user_id == User.id)
        .filter(User.role == UserRole.STUDENT)
    )
    if current_user.institution_id:
        query = query.filter(User.institution_id == current_user.institution_id)

    results = query.order_by(User.created_at.desc()).all()
    out = []
    for user, profile in results:
        out.append(
            StudentResponse(
                id=user.id,
                full_name=user.full_name,
                email=user.email,
                student_number=profile.student_number if profile else None,
                department=user.department or (profile.department if profile else None),
                role=user.role.value,
                account_status=user.account_status.value,
                created_at=user.created_at,
            )
        )
    return out


@router.get("/students/me/attendance-summary", response_model=List[ClassAttendanceSummary])
def get_student_attendance_summary(
    current_student: User = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """
    Returns server-calculated attendance percentage per enrolled class.
    Per PRD: Only completed (closed or expired) eligible sessions enter denominator.
    """
    now = datetime.now(timezone.utc)

    # Reconcile expired sessions
    expired = (
        db.query(AttendanceSession)
        .filter(AttendanceSession.status == SessionStatus.ACTIVE, AttendanceSession.ends_at <= now)
        .all()
    )
    for s in expired:
        s.status = SessionStatus.EXPIRED
    if expired:
        db.commit()

    # Query student's enrolled classes
    enrolled_classes = (
        db.query(Class)
        .join(ClassMembership, ClassMembership.class_id == Class.id)
        .filter(ClassMembership.student_id == current_student.id)
        .all()
    )

    summaries = []
    for cls in enrolled_classes:
        # Completed sessions for this class
        completed_sessions = (
            db.query(AttendanceSession)
            .filter(
                AttendanceSession.class_id == cls.id,
                AttendanceSession.status.in_([SessionStatus.CLOSED, SessionStatus.EXPIRED]),
            )
            .all()
        )
        total_completed = len(completed_sessions)

        completed_session_ids = [s.id for s in completed_sessions]

        attended_count = 0
        if completed_session_ids:
            attended_count = (
                db.query(AttendanceRecord)
                .filter(
                    AttendanceRecord.session_id.in_(completed_session_ids),
                    AttendanceRecord.student_id == current_student.id,
                    AttendanceRecord.status.in_([AttendanceStatus.PRESENT, AttendanceStatus.MANUAL_PRESENT]),
                )
                .count()
            )

        percentage = round((attended_count / total_completed * 100.0), 2) if total_completed > 0 else 0.0

        summaries.append(
            ClassAttendanceSummary(
                class_id=cls.id,
                class_name=cls.name,
                class_code=cls.code,
                attended_sessions=attended_count,
                total_completed_sessions=total_completed,
                percentage=percentage,
            )
        )

    return summaries


@router.get("/students/me/attendance-history", response_model=List[StudentAttendanceHistoryItem])
def get_student_attendance_history(
    current_student: User = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """Returns session-by-session history of attendance for the student."""
    records = (
        db.query(AttendanceRecord, AttendanceSession, Class)
        .join(AttendanceSession, AttendanceRecord.session_id == AttendanceSession.id)
        .join(Class, AttendanceSession.class_id == Class.id)
        .filter(AttendanceRecord.student_id == current_student.id)
        .order_by(AttendanceRecord.marked_at.desc())
        .all()
    )

    history = []
    for rec, sess, cls in records:
        history.append(
            StudentAttendanceHistoryItem(
                id=rec.id,
                session_id=sess.id,
                class_id=cls.id,
                class_name=cls.name,
                class_code=cls.code,
                session_date=sess.started_at,
                status=rec.status,
                source=rec.source,
                marked_at=rec.marked_at,
                reason=rec.reason,
            )
        )
    return history
