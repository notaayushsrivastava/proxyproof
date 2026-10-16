import uuid
import csv
import io
from typing import List, Optional
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.db.session import get_db
from backend.app.core.security import hash_password
from backend.app.core.dependencies import get_current_user, get_current_organizer
from backend.app.models.user import User, StudentProfile
from backend.app.models.class_model import Class, ClassMembership
from backend.app.models.enums import UserRole, AccountStatus
from backend.app.schemas.class_schema import (
    ClassCreate,
    ClassResponse,
    RosterMemberResponse,
    AddMemberRequest,
    StudentCreateRequest,
    StudentResponse,
    BulkStudentCsvRequest,
    BulkStudentOperationResult,
)
from backend.app.services.class_service import (
    create_class,
    get_classes_for_user,
    verify_organizer_class_access,
    add_student_to_roster,
    remove_student_from_roster,
)

router = APIRouter()


@router.get("", response_model=List[ClassResponse])
def list_classes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns classes visible to user based on role and enrolment."""
    return get_classes_for_user(db=db, user=current_user)


@router.post("", response_model=ClassResponse, status_code=status.HTTP_201_CREATED)
def create_new_class(
    payload: ClassCreate,
    current_organizer: User = Depends(get_current_organizer),
    db: Session = Depends(get_db),
):
    """Creates a new class owned by the authenticated organizer."""
    return create_class(
        db=db,
        organizer_id=current_organizer.id,
        name=payload.name,
        code=payload.code,
    )


@router.get("/{class_id}", response_model=ClassResponse)
def get_class_details(
    class_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns detailed information for a specific class."""
    return verify_organizer_class_access(db=db, class_id=class_id, user=current_user)


@router.get("/{class_id}/roster", response_model=List[RosterMemberResponse])
def get_class_roster(
    class_id: uuid.UUID,
    current_organizer: User = Depends(get_current_organizer),
    db: Session = Depends(get_db),
):
    """Returns the student roster for an assigned class."""
    verify_organizer_class_access(db=db, class_id=class_id, user=current_organizer)

    memberships = (
        db.query(ClassMembership, User, StudentProfile)
        .join(User, ClassMembership.student_id == User.id)
        .outerjoin(StudentProfile, StudentProfile.user_id == User.id)
        .filter(ClassMembership.class_id == class_id)
        .all()
    )

    roster = []
    for membership, student, profile in memberships:
        roster.append(
            RosterMemberResponse(
                student_id=student.id,
                email=student.email,
                full_name=student.full_name,
                student_number=profile.student_number if profile else None,
                joined_at=membership.joined_at,
            )
        )
    return roster


@router.post("/{class_id}/members", status_code=status.HTTP_201_CREATED)
def enroll_student(
    class_id: uuid.UUID,
    payload: AddMemberRequest,
    current_organizer: User = Depends(get_current_organizer),
    db: Session = Depends(get_db),
):
    """Enrolls a student into the class roster."""
    verify_organizer_class_access(db=db, class_id=class_id, user=current_organizer)
    add_student_to_roster(
        db=db,
        class_id=class_id,
        student_id=payload.student_id,
        actor_id=current_organizer.id,
    )
    return {"message": "Student successfully enrolled"}


@router.delete("/{class_id}/members/{student_id}")
def unenroll_student(
    class_id: uuid.UUID,
    student_id: uuid.UUID,
    current_organizer: User = Depends(get_current_organizer),
    db: Session = Depends(get_db),
):
    """Removes a student from the class roster."""
    verify_organizer_class_access(db=db, class_id=class_id, user=current_organizer)
    remove_student_from_roster(
        db=db,
        class_id=class_id,
        student_id=student_id,
        actor_id=current_organizer.id,
        reason="Removed by organizer",
    )
    return {"message": "Student successfully removed from roster"}


@router.post("/{class_id}/students", response_model=RosterMemberResponse, status_code=status.HTTP_201_CREATED)
def create_and_enroll_student(
    class_id: uuid.UUID,
    payload: StudentCreateRequest,
    current_organizer: User = Depends(get_current_organizer),
    db: Session = Depends(get_db),
):
    """Creates a new student account (or resolves existing) and enrolls them into the class roster."""
    classroom = verify_organizer_class_access(db=db, class_id=class_id, user=current_organizer)

    email = payload.email.strip().lower()
    student_number = payload.student_number.strip().upper()

    student = db.query(User).filter(func.lower(User.email) == email).first()
    if not student:
        existing_profile = db.query(StudentProfile).filter(StudentProfile.student_number == student_number).first()
        if existing_profile:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Student ID / Roll Number '{student_number}' is already registered.",
            )

        raw_pwd = payload.password if payload.password else "StudentPass@2026"
        student = User(
            id=uuid.uuid4(),
            email=email,
            password_hash=hash_password(raw_pwd),
            role=UserRole.STUDENT,
            full_name=payload.full_name.strip(),
            department=payload.department.strip() if payload.department else None,
            institution_id=current_organizer.institution_id,
            account_status=AccountStatus.ACTIVE,
        )
        db.add(student)
        db.flush()

        profile = StudentProfile(
            user_id=student.id,
            student_number=student_number,
            department=payload.department.strip() if payload.department else None,
        )
        db.add(profile)
        db.flush()
    else:
        profile = db.query(StudentProfile).filter(StudentProfile.user_id == student.id).first()

    existing_membership = (
        db.query(ClassMembership)
        .filter(ClassMembership.class_id == class_id, ClassMembership.student_id == student.id)
        .first()
    )
    if not existing_membership:
        membership = ClassMembership(
            id=uuid.uuid4(),
            class_id=class_id,
            student_id=student.id,
        )
        db.add(membership)
        db.commit()
        db.refresh(membership)
    else:
        membership = existing_membership

    db.refresh(student)
    return RosterMemberResponse(
        student_id=student.id,
        email=student.email,
        full_name=student.full_name,
        student_number=profile.student_number if profile else None,
        joined_at=membership.joined_at,
    )


@router.post("/{class_id}/students/bulk-csv", response_model=BulkStudentOperationResult)
def bulk_upload_roster_csv(
    class_id: uuid.UUID,
    payload: BulkStudentCsvRequest,
    current_organizer: User = Depends(get_current_organizer),
    db: Session = Depends(get_db),
):
    """Mass uploads a CSV of students and enrolls them directly into the class roster."""
    classroom = verify_organizer_class_access(db=db, class_id=class_id, user=current_organizer)

    csv_text = payload.csv_content.strip()
    if not csv_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV content cannot be empty.",
        )

    reader = csv.reader(io.StringIO(csv_text))
    created_count = 0
    enrolled_count = 0
    failed_count = 0
    errors = []

    header_skipped = False
    for row_idx, row in enumerate(reader, start=1):
        clean_row = [c.strip() for c in row if c is not None]
        if not clean_row or not any(clean_row):
            continue

        # Header detection
        first_cell = clean_row[0].lower()
        has_email = any("@" in c for c in clean_row)
        normalized_first = first_cell.replace(" ", "_").replace("-", "_")
        if not header_skipped and (
            normalized_first in ["name", "full_name", "fullname", "student_name", "student_id", "email", "roll_no", "reg_no"]
            or not has_email
        ):
            header_skipped = True
            continue

        if len(clean_row) < 3:
            errors.append(f"Row {row_idx}: Insufficient columns. Need Name, Email, and Student ID.")
            failed_count += 1
            continue

        if "@" in clean_row[1]:
            name = clean_row[0]
            email = clean_row[1].lower()
            student_num = clean_row[2].upper()
            dept = clean_row[3] if len(clean_row) > 3 and clean_row[3] else None
        elif "@" in clean_row[2]:
            student_num = clean_row[0].upper()
            name = clean_row[1]
            email = clean_row[2].lower()
            dept = clean_row[3] if len(clean_row) > 3 and clean_row[3] else None
        elif "@" in clean_row[0]:
            email = clean_row[0].lower()
            name = clean_row[1]
            student_num = clean_row[2].upper()
            dept = clean_row[3] if len(clean_row) > 3 and clean_row[3] else None
        else:
            errors.append(f"Row {row_idx}: Could not locate a valid email address.")
            failed_count += 1
            continue

        if not email or "@" not in email:
            errors.append(f"Row {row_idx}: Invalid email '{email}'.")
            failed_count += 1
            continue

        if not name or not student_num:
            errors.append(f"Row {row_idx}: Name and Student ID are required.")
            failed_count += 1
            continue

        try:
            student = db.query(User).filter(func.lower(User.email) == email).first()
            if not student:
                existing_profile = db.query(StudentProfile).filter(StudentProfile.student_number == student_num).first()
                if existing_profile:
                    errors.append(f"Row {row_idx}: Student ID '{student_num}' is already claimed by another account.")
                    failed_count += 1
                    continue

                student = User(
                    id=uuid.uuid4(),
                    email=email,
                    password_hash=hash_password("StudentPass@2026"),
                    role=UserRole.STUDENT,
                    full_name=name,
                    department=dept,
                    institution_id=current_organizer.institution_id,
                    account_status=AccountStatus.ACTIVE,
                )
                db.add(student)
                db.flush()

                profile = StudentProfile(
                    user_id=student.id,
                    student_number=student_num,
                    department=dept,
                )
                db.add(profile)
                db.flush()
                created_count += 1

            existing_membership = (
                db.query(ClassMembership)
                .filter(ClassMembership.class_id == class_id, ClassMembership.student_id == student.id)
                .first()
            )
            if not existing_membership:
                membership = ClassMembership(
                    id=uuid.uuid4(),
                    class_id=class_id,
                    student_id=student.id,
                )
                db.add(membership)
                db.flush()
                enrolled_count += 1
        except Exception as exc:
            errors.append(f"Row {row_idx}: Error processing '{email}': {str(exc)}")
            failed_count += 1

    if enrolled_count > 0 or created_count > 0:
        db.commit()

    return BulkStudentOperationResult(
        created_count=created_count,
        enrolled_count=enrolled_count,
        failed_count=failed_count,
        errors=errors,
        message=f"Roster import complete: {enrolled_count} enrolled ({created_count} newly registered)."
        + (f" {failed_count} row(s) had errors or were skipped." if failed_count > 0 else ""),
    )
