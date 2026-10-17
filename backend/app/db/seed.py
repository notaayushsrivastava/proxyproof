import sys
import uuid
from sqlalchemy import text
from sqlalchemy.orm import Session
from backend.app.db.session import SessionLocal
from backend.app.core.security import hash_password
from backend.app.models.enums import (
    UserRole,
    AccountStatus,
    DevicePlatform,
    DeviceStatus,
)
from backend.app.models import (
    User,
    StudentProfile,
    Class,
    ClassMembership,
    Device,
    Institution,
)

DEFAULT_DEV_PASSWORD = "Password123!"


def seed_database(db: Session, admin_only: bool = False):
    print("--- Starting ProxyProof Database Seeding ---")

    # 0. Clean wipe: delete all existing records in reverse dependency / cascade order
    print("• Wiping all existing records from database...")
    db.execute(
        text(
            "TRUNCATE TABLE attendance_records, attendance_attempts, "
            "device_change_requests, class_memberships, attendance_sessions, "
            "student_profiles, devices, classes, users, institutions CASCADE;"
        )
    )
    db.commit()
    print("✓ All tables truncated successfully.")

    # 1. Primary Institution Admin Account (admin@university.local)
    # Created first with institution_id = None to satisfy circular foreign key
    admin_id = uuid.uuid4()
    admin_email = "admin@university.local"
    admin_pwd = "AdminPass123!"
    admin_user = User(
        id=admin_id,
        email=admin_email,
        password_hash=hash_password(admin_pwd),
        role=UserRole.ADMIN,
        full_name="University System Administrator",
        account_status=AccountStatus.ACTIVE,
    )
    db.add(admin_user)
    db.flush()

    # 2. Single Shared Institution (University of Technology / UNIV / university.local)
    institution_id = uuid.uuid4()
    institution = Institution(
        id=institution_id,
        name="University of Technology",
        code="UNIV",
        domain="university.local",
        contact_email="admin@university.local",
        department="School of Computing & Engineering",
        admin_user_id=admin_user.id,
        hardware_binding_enforced=True,
        attendance_window_seconds=15,
        status="active",
    )
    db.add(institution)
    db.flush()

    # Link admin to this institution
    admin_user.institution_id = institution.id
    db.flush()
    print(f"✓ Provisioned Institution: {institution.name} ({institution.code}) with Admin: {admin_email}")

    if admin_only:
        db.commit()
        print("✓ Completed admin-only seed.")
        return

    # 3. Faculty / Broadcaster Account (smith@university.local)
    organizer = User(
        id=uuid.uuid4(),
        email="smith@university.local",
        password_hash=hash_password("ProfPass123!"),
        role=UserRole.ORGANIZER,
        full_name="Prof. John Smith",
        department="Department of Computer Science",
        institution_id=institution.id,
        account_status=AccountStatus.ACTIVE,
    )
    db.add(organizer)
    db.flush()
    print(f"✓ Created Faculty Broadcaster: {organizer.email} ({organizer.full_name})")

    # 4. Student Accounts (under the same institution)
    # Alice: enrolled with active device
    alice = User(
        id=uuid.uuid4(),
        email="alice@university.local",
        password_hash=hash_password("StudentPass123!"),
        role=UserRole.STUDENT,
        full_name="Alice Smith",
        department="Computer Science",
        institution_id=institution.id,
        account_status=AccountStatus.ACTIVE,
    )
    db.add(alice)
    db.flush()

    alice_profile = StudentProfile(
        user_id=alice.id,
        student_number="2026-CS-001",
        department="Computer Science",
    )
    db.add(alice_profile)

    alice_device = Device(
        id=uuid.uuid4(),
        user_id=alice.id,
        platform=DevicePlatform.ANDROID,
        device_label="Alice Galaxy S24",
        status=DeviceStatus.ACTIVE,
        public_key="mc4CAQAwBQYDK2VwBCIEIH7+AlicePublicKeyForTestingOnly==",
    )
    db.add(alice_device)
    print(f"✓ Created Student: {alice.email} (Roll: 2026-CS-001) with Active Android Device")

    # Bob: unenrolled from test class, with active device
    bob = User(
        id=uuid.uuid4(),
        email="bob@university.local",
        password_hash=hash_password("StudentPass123!"),
        role=UserRole.STUDENT,
        full_name="Bob Johnson",
        department="Computer Science",
        institution_id=institution.id,
        account_status=AccountStatus.ACTIVE,
    )
    db.add(bob)
    db.flush()

    bob_profile = StudentProfile(
        user_id=bob.id,
        student_number="2026-CS-002",
        department="Computer Science",
    )
    db.add(bob_profile)

    bob_device = Device(
        id=uuid.uuid4(),
        user_id=bob.id,
        platform=DevicePlatform.IOS,
        device_label="Bob iPhone 16 Pro",
        status=DeviceStatus.ACTIVE,
        public_key="mc4CAQAwBQYDK2VwBCIEIH7+BobPublicKeyForTestingOnly==",
    )
    db.add(bob_device)
    print(f"✓ Created Student: {bob.email} (Roll: 2026-CS-002) with Active iOS Device (Unenrolled)")

    # 5. Course Class: CS401-2026 under the institution owned by Smith
    class_code = "CS401-2026"
    sample_class = Class(
        id=uuid.uuid4(),
        name="CS401: Distributed Systems & Security",
        code=class_code,
        owner_organizer_id=organizer.id,
        institution_id=institution.id,
    )
    db.add(sample_class)
    db.flush()
    print(f"✓ Created Course: {sample_class.name} ({class_code}) owned by {organizer.email}")

    # Enroll Alice only; Bob remains unenrolled
    membership = ClassMembership(
        id=uuid.uuid4(),
        class_id=sample_class.id,
        student_id=alice.id,
    )
    db.add(membership)
    print(f"✓ Enrolled {alice.email} into {class_code} (Bob remains unenrolled)")

    db.commit()
    print("--- Database Seeding Completed Successfully ---")


if __name__ == "__main__":
    admin_only_flag = "--admin-only" in sys.argv
    session = SessionLocal()
    try:
        seed_database(session, admin_only=admin_only_flag)
    finally:
        session.close()

