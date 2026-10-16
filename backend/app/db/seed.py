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
)

DEFAULT_DEV_PASSWORD = "Password123!"


def seed_database(db: Session, admin_only: bool = False):
    print("--- Starting ProxyProof Database Seeding ---")

    # 1. Admin Accounts
    admin_accounts = [
        ("admin@proxyproof.local", DEFAULT_DEV_PASSWORD, "System Administrator"),
        ("admin@university.local", "AdminPass123!", "University Admin"),
    ]
    for email, pwd, name in admin_accounts:
        existing_admin = db.query(User).filter(User.email == email).first()
        if not existing_admin:
            admin = User(
                id=uuid.uuid4(),
                email=email,
                password_hash=hash_password(pwd),
                role=UserRole.ADMIN,
                full_name=name,
                account_status=AccountStatus.ACTIVE,
            )
            db.add(admin)
            db.flush()
            print(f"✓ Created Admin user: {email}")
        else:
            print(f"• Admin user already exists: {email}")

    if admin_only:
        db.commit()
        print("✓ Completed admin-only seed.")
        return

    # 2. Organizer Accounts
    organizer_accounts = [
        ("organizer@proxyproof.local", DEFAULT_DEV_PASSWORD, "Prof. Alan Turing"),
        ("smith@university.local", "ProfPass123!", "Prof. John Smith"),
    ]
    organizers = []
    for email, pwd, name in organizer_accounts:
        existing_org = db.query(User).filter(User.email == email).first()
        if not existing_org:
            org = User(
                id=uuid.uuid4(),
                email=email,
                password_hash=hash_password(pwd),
                role=UserRole.ORGANIZER,
                full_name=name,
                account_status=AccountStatus.ACTIVE,
            )
            db.add(org)
            db.flush()
            print(f"✓ Created Organizer: {email}")
            organizers.append(org)
        else:
            organizers.append(existing_org)
            print(f"• Organizer already exists: {email}")

    # 3. Student Accounts
    students_data = [
        ("student1@proxyproof.local", DEFAULT_DEV_PASSWORD, "Alice Smith", "CS2026001", "Computer Science"),
        ("alice@university.local", "StudentPass123!", "Alice Smith", "2026-CS-001", "Computer Science"),
        ("student2@proxyproof.local", DEFAULT_DEV_PASSWORD, "Bob Johnson", "CS2026002", "Computer Science"),
        ("bob@university.local", "StudentPass123!", "Bob Johnson", "2026-CS-002", "Computer Science"),
        ("student3@proxyproof.local", DEFAULT_DEV_PASSWORD, "Charlie Brown", "CS2026003", "Data Science"),
    ]

    created_students = []
    for email, pwd, name, roll_no, dept in students_data:
        existing_student = db.query(User).filter(User.email == email).first()
        if not existing_student:
            student = User(
                id=uuid.uuid4(),
                email=email,
                password_hash=hash_password(pwd),
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

            # Register default active device
            if email in ("student1@proxyproof.local", "alice@university.local", "student2@proxyproof.local", "student3@proxyproof.local"):
                device = Device(
                    id=uuid.uuid4(),
                    user_id=student.id,
                    platform=DevicePlatform.ANDROID if "student1" in email or "alice" in email else DevicePlatform.IOS,
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
    primary_org = organizers[0] if organizers else None
    if not existing_class and primary_org:
        sample_class = Class(
            id=uuid.uuid4(),
            name="CS401: Distributed Systems & Security",
            code=class_code,
            owner_organizer_id=primary_org.id,
        )
        db.add(sample_class)
        db.flush()
        print(f"✓ Created Class: {sample_class.name} ({class_code})")

        # Enroll all students except the last one (Charlie remains unenrolled for non-enrolment testing)
        for student in created_students[:-1]:
            membership = ClassMembership(
                id=uuid.uuid4(),
                class_id=sample_class.id,
                student_id=student.id,
            )
            db.add(membership)
            print(f"✓ Enrolled {student.email} into {class_code}")
    else:
        print(f"• Class already exists: {class_code}")

    # Also give smith@university.local an assigned class if they exist
    if len(organizers) > 1:
        smith_class_code = "CS502-2026"
        existing_smith_class = db.query(Class).filter(Class.code == smith_class_code).first()
        if not existing_smith_class:
            smith_class = Class(
                id=uuid.uuid4(),
                name="CS502: Advanced Cryptography",
                code=smith_class_code,
                owner_organizer_id=organizers[1].id,
            )
            db.add(smith_class)
            db.flush()
            for student in created_students[:-1]:
                membership = ClassMembership(
                    id=uuid.uuid4(),
                    class_id=smith_class.id,
                    student_id=student.id,
                )
                db.add(membership)
            print(f"✓ Created Class: {smith_class.name} ({smith_class_code}) for {organizers[1].email}")

    db.commit()
    print("--- Database Seeding Completed Successfully ---")


if __name__ == "__main__":
    admin_only_flag = "--admin-only" in sys.argv
    session = SessionLocal()
    try:
        seed_database(session, admin_only=admin_only_flag)
    finally:
        session.close()
