import uuid
from datetime import datetime, timezone
from typing import Optional, List, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from backend.app.core.config import settings
from backend.app.core.security import verify_hmac_proof
from backend.app.models.enums import (
    UserRole,
    AccountStatus,
    DeviceStatus,
    SessionStatus,
    AttendanceStatus,
    AttendanceSource,
)
from backend.app.models import (
    User,
    Device,
    ClassMembership,
    AttendanceSession,
    AttendanceRecord,
    AttendanceAttempt,
)
from backend.app.services.websocket_manager import ws_manager


class ValidationResult:
    def __init__(
        self,
        success: bool,
        outcome_code: str,
        message: str,
        record: Optional[AttendanceRecord] = None,
    ):
        self.success = success
        self.outcome_code = outcome_code
        self.message = message
        self.record = record


async def validate_and_record_attendance(
    db: Session,
    student: User,
    session_id: uuid.UUID,
    proof: str,
    client_time_slot: int,
    request_id: str,
    rssi_median: int,
    rssi_samples: Optional[List[int]] = None,
    protocol_version: int = 1,
) -> ValidationResult:
    """
    Core authoritative attendance validation service as mandated by PRD Section 10.
    Enforces idempotency, device binding, class enrollment, session state,
    rotating HMAC token freshness, and RSSI proximity heuristic.
    """
    now = datetime.now(timezone.utc)

    # 1. Check idempotency key first: if request_id already processed, return cached outcome
    existing_attempt = (
        db.query(AttendanceAttempt)
        .filter(AttendanceAttempt.request_id == request_id)
        .first()
    )
    if existing_attempt:
        existing_record = (
            db.query(AttendanceRecord)
            .filter(
                AttendanceRecord.session_id == session_id,
                AttendanceRecord.student_id == student.id,
            )
            .first()
        )
        return ValidationResult(
            success=existing_attempt.outcome_code in ("SUCCESS", "ALREADY_MARKED"),
            outcome_code=existing_attempt.outcome_code,
            message="Idempotent replay: previous attempt retrieved",
            record=existing_record,
        )

    # Helper to log attempt and return failure
    def log_and_fail(
        outcome_code: str,
        message: str,
        active_device_id: Optional[uuid.UUID] = None,
    ) -> ValidationResult:
        attempt = AttendanceAttempt(
            id=uuid.uuid4(),
            session_id=session_id,
            student_id=student.id,
            device_id=active_device_id,
            request_id=request_id,
            timestamp=now,
            outcome_code=outcome_code,
            client_rssi_median=rssi_median,
            client_rssi_samples={"samples": rssi_samples} if rssi_samples else None,
            protocol_version=protocol_version,
            proof_time_slot=client_time_slot,
        )
        db.add(attempt)
        db.commit()
        return ValidationResult(success=False, outcome_code=outcome_code, message=message)

    # 2. Confirm student account is active
    if student.account_status != AccountStatus.ACTIVE or student.role != UserRole.STUDENT:
        return log_and_fail("STUDENT_INACTIVE", "Student account is not active or unauthorized")

    # 3. Resolve active registered device
    active_device = (
        db.query(Device)
        .filter(Device.user_id == student.id, Device.status == DeviceStatus.ACTIVE)
        .first()
    )
    if not active_device:
        return log_and_fail("NO_ACTIVE_DEVICE", "Student does not have an approved active device registered")

    # 4. Load session & reconcile auto-expiry
    target_session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not target_session:
        return log_and_fail("SESSION_NOT_FOUND", "Attendance session not found", active_device.id)

    # Check if session has reached end time
    if target_session.status == SessionStatus.ACTIVE and now >= target_session.ends_at:
        target_session.status = SessionStatus.EXPIRED
        db.commit()

    if target_session.status != SessionStatus.ACTIVE:
        return log_and_fail(
            f"SESSION_{target_session.status.value.upper()}",
            f"Session is {target_session.status.value} and cannot accept attendance",
            active_device.id,
        )

    # 5. Confirm class enrolment
    membership = (
        db.query(ClassMembership)
        .filter(
            ClassMembership.class_id == target_session.class_id,
            ClassMembership.student_id == student.id,
        )
        .first()
    )
    if not membership:
        return log_and_fail("NOT_ENROLLED", "Student is not enrolled in this class", active_device.id)

    # 6. Validate rotating proof freshness & HMAC
    current_server_slot = int(now.timestamp() // settings.PROOF_VALIDITY_SECONDS)
    allowed_drift_slots = [
        current_server_slot - settings.DRIFT_WINDOW_SLOTS,
        current_server_slot,
        current_server_slot + settings.DRIFT_WINDOW_SLOTS,
    ]

    if client_time_slot not in allowed_drift_slots:
        outcome = "STALE_PROOF" if client_time_slot < current_server_slot else "FUTURE_PROOF"
        return log_and_fail(outcome, "Rotating BLE token has expired or is invalid for this time slot", active_device.id)

    # Constant-time HMAC match
    secret_hex = target_session.beacon_secret_ciphertext
    is_proof_valid = verify_hmac_proof(
        candidate_proof=proof,
        session_secret_hex=secret_hex,
        session_id=target_session.id,
        time_slot=client_time_slot,
        protocol_version=protocol_version,
    )
    if not is_proof_valid:
        return log_and_fail("INVALID_PROOF", "Cryptographic session token is invalid", active_device.id)

    # 7. Validate proximity threshold
    if rssi_median < target_session.proximity_threshold:
        return log_and_fail(
            "BELOW_PROXIMITY_THRESHOLD",
            f"Observed RSSI ({rssi_median} dBm) does not meet proximity requirement ({target_session.proximity_threshold} dBm)",
            active_device.id,
        )

    # 8. Insert or return existing attendance record idempotently in transaction
    existing_record = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.session_id == session_id,
            AttendanceRecord.student_id == student.id,
        )
        .first()
    )

    if existing_record:
        # Already marked present
        attempt = AttendanceAttempt(
            id=uuid.uuid4(),
            session_id=session_id,
            student_id=student.id,
            device_id=active_device.id,
            request_id=request_id,
            timestamp=now,
            outcome_code="ALREADY_MARKED",
            client_rssi_median=rssi_median,
            client_rssi_samples={"samples": rssi_samples} if rssi_samples else None,
            protocol_version=protocol_version,
            proof_time_slot=client_time_slot,
        )
        db.add(attempt)
        db.commit()
        return ValidationResult(
            success=True,
            outcome_code="ALREADY_MARKED",
            message="Student was already marked present for this session",
            record=existing_record,
        )

    # Create new attendance record
    new_record = AttendanceRecord(
        id=uuid.uuid4(),
        session_id=session_id,
        student_id=student.id,
        status=AttendanceStatus.PRESENT,
        source=AttendanceSource.BLE,
        marked_at=now,
    )
    db.add(new_record)

    attempt = AttendanceAttempt(
        id=uuid.uuid4(),
        session_id=session_id,
        student_id=student.id,
        device_id=active_device.id,
        request_id=request_id,
        timestamp=now,
        outcome_code="SUCCESS",
        client_rssi_median=rssi_median,
        client_rssi_samples={"samples": rssi_samples} if rssi_samples else None,
        protocol_version=protocol_version,
        proof_time_slot=client_time_slot,
    )
    db.add(attempt)

    try:
        db.commit()
        db.refresh(new_record)
    except IntegrityError:
        db.rollback()
        # Concurrency race: another request marked concurrently
        saved_record = (
            db.query(AttendanceRecord)
            .filter(
                AttendanceRecord.session_id == session_id,
                AttendanceRecord.student_id == student.id,
            )
            .first()
        )
        return ValidationResult(
            success=True,
            outcome_code="ALREADY_MARKED",
            message="Student was marked present concurrently",
            record=saved_record,
        )

    # 10. Broadcast live dashboard event to organizer
    event_payload = {
        "sessionId": str(session_id),
        "studentId": str(student.id),
        "studentName": student.full_name,
        "status": new_record.status.value,
        "source": new_record.source.value,
        "markedAt": new_record.marked_at.isoformat(),
    }
    await ws_manager.broadcast_session_event(
        session_id=session_id,
        event_type="attendance.marked",
        data=event_payload,
    )

    return ValidationResult(
        success=True,
        outcome_code="SUCCESS",
        message="Attendance recorded successfully",
        record=new_record,
    )
