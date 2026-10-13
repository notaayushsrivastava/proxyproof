import uuid
from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient
from backend.app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_token,
    verify_hmac_proof,
)
from backend.app.models.enums import (
    UserRole,
    AccountStatus,
    DevicePlatform,
    DeviceStatus,
    SessionStatus,
    AttendanceStatus,
    AttendanceSource,
)
from backend.app.models import (
    User,
    Device,
    Class,
    AttendanceSession,
    AttendanceRecord,
)


def test_database_connectivity(db_session: Session):
    """Verifies direct database query connectivity to PostgreSQL."""
    result = db_session.execute(text("SELECT 1")).scalar()
    assert result == 1


def test_health_check_endpoint(client: TestClient):
    """Verifies that the FastAPI health check returns status 200 and healthy."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"


def test_argon2id_password_hashing():
    """Verifies Argon2id password hashing and constant-time verification."""
    password = "SuperSecretPassword123!"
    hashed = hash_password(password)
    assert hashed.startswith("$argon2id$")
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_jwt_token_creation_and_decoding():
    """Verifies JWT access token generation and payload decoding."""
    user_id = uuid.uuid4()
    token = create_access_token(subject=user_id, role="student")
    payload = decode_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["role"] == "student"
    assert "exp" in payload


def test_one_active_device_constraint(db_session: Session):
    """
    Verifies that the partial unique index uq_one_active_device_per_student
    strictly prevents more than one active device per student.
    """
    # Create temporary student
    student = User(
        id=uuid.uuid4(),
        email=f"device_test_{uuid.uuid4().hex[:8]}@proxyproof.local",
        password_hash=hash_password("Pass123!"),
        role=UserRole.STUDENT,
        full_name="Device Constraint Test",
        account_status=AccountStatus.ACTIVE,
    )
    db_session.add(student)
    db_session.flush()

    # Add first active device
    device1 = Device(
        id=uuid.uuid4(),
        user_id=student.id,
        platform=DevicePlatform.ANDROID,
        status=DeviceStatus.ACTIVE,
    )
    db_session.add(device1)
    db_session.flush()

    # Attempt to add a second ACTIVE device for the same student
    device2 = Device(
        id=uuid.uuid4(),
        user_id=student.id,
        platform=DevicePlatform.IOS,
        status=DeviceStatus.ACTIVE,
    )
    db_session.add(device2)

    with pytest.raises(IntegrityError):
        db_session.flush()

    db_session.rollback()


def test_attendance_uniqueness_constraint(db_session: Session):
    """
    Verifies that the database prevents duplicate attendance records
    for the same (session_id, student_id) pair.
    """
    # Query seeded organizer and class
    organizer = db_session.query(User).filter(User.role == UserRole.ORGANIZER).first()
    sample_class = db_session.query(Class).first()
    student = db_session.query(User).filter(User.role == UserRole.STUDENT).first()

    now = datetime.now(timezone.utc)
    session = AttendanceSession(
        id=uuid.uuid4(),
        class_id=sample_class.id,
        organizer_id=organizer.id,
        status=SessionStatus.ACTIVE,
        started_at=now,
        ends_at=now + timedelta(minutes=5),
        beacon_secret_ciphertext="dummy_secret",
        protocol_version=1,
    )
    db_session.add(session)
    db_session.flush()

    # Add first attendance mark
    record1 = AttendanceRecord(
        id=uuid.uuid4(),
        session_id=session.id,
        student_id=student.id,
        status=AttendanceStatus.PRESENT,
        source=AttendanceSource.BLE,
    )
    db_session.add(record1)
    db_session.flush()

    # Attempt duplicate mark
    record2 = AttendanceRecord(
        id=uuid.uuid4(),
        session_id=session.id,
        student_id=student.id,
        status=AttendanceStatus.PRESENT,
        source=AttendanceSource.MANUAL,
    )
    db_session.add(record2)

    with pytest.raises(IntegrityError):
        db_session.flush()

    db_session.rollback()


def test_hmac_proof_verification():
    """Verifies constant-time HMAC token proof verification in core security."""
    session_id = uuid.uuid4()
    secret_hex = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    slot = 1000

    # Derive proof
    import struct, hmac, hashlib
    msg = struct.pack(">B", 1) + session_id.bytes + struct.pack(">I", slot)
    valid_proof = hmac.new(bytes.fromhex(secret_hex), msg, hashlib.sha256).hexdigest()[:32]

    assert verify_hmac_proof(valid_proof, secret_hex, session_id, slot, 1) is True
    assert verify_hmac_proof("invalid_proof_hex_32_characters", secret_hex, session_id, slot, 1) is False
    assert verify_hmac_proof(valid_proof, secret_hex, session_id, slot + 1, 1) is False
