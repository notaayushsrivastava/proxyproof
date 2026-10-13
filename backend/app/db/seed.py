import sys
import uuid
from datetime import datetime, timezone
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
    AuditLog,
)

DEFAULT_DEV_PASSWORD = "Password123!"


def seed_database(db: Session, admin_only: bool = False):
    print("--- Starting ProxyProof Database Seeding ---")

    # 1. Admin Account
    admin_email = "admin@proxyproof.local"
    existing_admin = db.query(User).filter(User.email == admin_email).first()
    if not existing_admin:
        admin = User(
            id=uuid.uuid4(),
            email=admin_email,
            password_hash=hash_password(DEFAULT_DEV_PASSWORD),
            role=UserRole.ADMIN,
            full_name="System Administrator",
            account_status=AccountStatus.ACTIVE,
        )
        db.add(admin)
        db.flush()
        print(f"✓ Created Admin user: {admin_email}")

        audit = AuditLog(
            id=uuid.uuid4(),
            actor_id=admin.id,
            action="BOOTSTRAP_ADMIN",
            target_type="user",
            target_id=str(admin.id),
            reason="Initial system bootstrap",
        )
        db.add(audit)
    else:
        print(f"• Admin user already exists: {admin_email}")

    if admin_only:
        db.commit()
        print("✓ Completed admin-only seed.")
        return

    # 2. Organizer Account
    organizer_email = "organizer@proxyproof.local"
    existing_org = db.query(User).filter(User.email == organizer_email).first()
    if not existing_org:
        organizer = User(
            id=uuid.uuid4(),
            email=organizer_email,
            password_hash=hash_password(DEFAULT_DEV_PASSWORD),
            role=UserRole.ORGANIZER,
            full_name="Prof. Alan Turing",
            account_status=AccountStatus.ACTIVE,
        )
        db.add(organizer)
        db.flush()
        print(f"✓ Created Organizer: {organizer_email}")
    else:
        organizer = existing_org
        print(f"• Organizer already exists: {organizer_email}")

    # 3. Student Accounts
    students_data = [
        ("student1@proxyproof.local", "Alice Smith", "CS2026001", "Computer Science"),
        ("student2@proxyproof.local", "Bob Johnson", "CS2026002", "Computer Science"),
        ("student3@proxyproof.local", "Charlie Brown", "CS2026003", "Data Science"),
    ]

    created_students = []
    for email, name, roll_no, dept in students_data:
        existing_student = db.query(User).filter(User.email == email).first()
        if not existing_student:
            student = User(
                id=uuid.uuid4(),
                email=email,
                password_hash=hash_password(DEFAULT_DEV_PASSWORD),
                role=UserRole.STUDENT,
                full_name=name,
                account_status=AccountStatus.ACTIVE,
            )
            db.add(student)
            db.flush()

            profile = StudentProfile(
                user_id=student.id,
                student_number=roll_no,
                department=dept,
            )
            db.add(profile)

            # Register default active device for student1 and student2
            if email in ("student1@proxyproof.local", "student2@proxyproof.local"):
                device = Device(
                    id=uuid.uuid4(),
                    user_id=student.id,
                    platform=DevicePlatform.ANDROID if email == "student1@proxyproof.local" else DevicePlatform.IOS,
                    device_label="Primary Phone",
                    status=DeviceStatus.ACTIVE,
                    public_key="mc4CAQAwBQYDK2VwBCIEIH7+DevPublicKeyExampleForTestingOnly==",
                )
                db.add(device)

            created_students.append(student)
            print(f"✓ Created Student: {email} ({roll_no})")
        else:
            created_students.append(existing_student)
            print(f"• Student already exists: {email}")

    # 4. Sample Class
    class_code = "CS401-2026"
    existing_class = db.query(Class).filter(Class.code == class_code).first()
    if not existing_class:
        sample_class = Class(
            id=uuid.uuid4(),
            name="CS401: Distributed Systems & Security",
            code=class_code,
            owner_organizer_id=organizer.id,
        )
        db.add(sample_class)
        db.flush()
        print(f"✓ Created Class: {sample_class.name} ({class_code})")

        # Enroll Alice and Bob (Charlie remains unenrolled for non-enrolment testing)
        for student in created_students[:2]:
            membership = ClassMembership(
                id=uuid.uuid4(),
                class_id=sample_class.id,
                student_id=student.id,
            )
            db.add(membership)
            print(f"✓ Enrolled {student.email} into {class_code}")
    else:
        print(f"• Class already exists: {class_code}")

    db.commit()
    print("--- Database Seeding Completed Successfully ---")


if __name__ == "__main__":
    admin_only_flag = "--admin-only" in sys.argv
    session = SessionLocal()
    try:
        seed_database(session, admin_only=admin_only_flag)
    finally:
        session.close()
