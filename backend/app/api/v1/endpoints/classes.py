import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.core.dependencies import get_current_user, get_current_organizer
from backend.app.models.user import User, StudentProfile
from backend.app.models.class_model import Class, ClassMembership
from backend.app.schemas.class_schema import (
    ClassCreate,
    ClassResponse,
    RosterMemberResponse,
    AddMemberRequest,
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
