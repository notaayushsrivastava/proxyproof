import uuid
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from backend.app.models import Class, ClassMembership, User
from backend.app.models.enums import UserRole
from backend.app.services.audit_service import log_audit_event


def create_class(
    db: Session,
    organizer_id: uuid.UUID,
    name: str,
    code: str,
) -> Class:
    """Creates a new class owned by the designated organizer."""
    existing = db.query(Class).filter(Class.code == code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Class code '{code}' is already in use",
        )

    organizer = db.query(User).filter(User.id == organizer_id).first()

    new_class = Class(
        id=uuid.uuid4(),
        name=name,
        code=code,
        owner_organizer_id=organizer_id,
        institution_id=organizer.institution_id if organizer else None,
    )
    db.add(new_class)
    db.flush()

    log_audit_event(
        db=db,
        actor_id=organizer_id,
        action="CLASS_CREATED",
        target_type="class",
        target_id=str(new_class.id),
        metadata_json={"name": name, "code": code},
    )
    db.commit()
    db.refresh(new_class)
    return new_class


def get_classes_for_user(db: Session, user: User) -> List[Class]:
    """Returns classes scoped strictly to user role, institution, and assignments."""
    if user.role == UserRole.ADMIN:
        query = db.query(Class)
        if user.institution_id:
            query = query.filter(Class.institution_id == user.institution_id)
        return query.order_by(Class.created_at.desc()).all()
    elif user.role == UserRole.ORGANIZER:
        return (
            db.query(Class)
            .filter(Class.owner_organizer_id == user.id)
            .order_by(Class.created_at.desc())
            .all()
        )
    else:  # Student
        return (
            db.query(Class)
            .join(ClassMembership, ClassMembership.class_id == Class.id)
            .filter(ClassMembership.student_id == user.id)
            .order_by(Class.created_at.desc())
            .all()
        )


def verify_organizer_class_access(db: Session, class_id: uuid.UUID, user: User) -> Class:
    """Confirms that the organizer owns the class (or is an admin)."""
    target_class = db.query(Class).filter(Class.id == class_id).first()
    if not target_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    if user.role != UserRole.ADMIN and target_class.owner_organizer_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to manage this class",
        )
    return target_class


def add_student_to_roster(
    db: Session,
    class_id: uuid.UUID,
    student_id: uuid.UUID,
    actor_id: uuid.UUID,
) -> ClassMembership:
    """Enrolls a student into a class."""
    student = db.query(User).filter(User.id == student_id, User.role == UserRole.STUDENT).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found or user is not a student",
        )

    existing = (
        db.query(ClassMembership)
        .filter(ClassMembership.class_id == class_id, ClassMembership.student_id == student_id)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student is already enrolled in this class",
        )

    membership = ClassMembership(
        id=uuid.uuid4(),
        class_id=class_id,
        student_id=student_id,
    )
    db.add(membership)
    db.flush()

    log_audit_event(
        db=db,
        actor_id=actor_id,
        action="ROSTER_STUDENT_ADDED",
        target_type="class_membership",
        target_id=str(membership.id),
        metadata_json={"class_id": str(class_id), "student_id": str(student_id)},
    )
    db.commit()
    db.refresh(membership)
    return membership


def remove_student_from_roster(
    db: Session,
    class_id: uuid.UUID,
    student_id: uuid.UUID,
    actor_id: uuid.UUID,
    reason: Optional[str] = None,
) -> bool:
    """Removes a student from class roster with an audit entry."""
    membership = (
        db.query(ClassMembership)
        .filter(ClassMembership.class_id == class_id, ClassMembership.student_id == student_id)
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student membership not found in this class",
        )

    membership_id = membership.id
    db.delete(membership)
    db.flush()

    log_audit_event(
        db=db,
        actor_id=actor_id,
        action="ROSTER_STUDENT_REMOVED",
        target_type="class_membership",
        target_id=str(membership_id),
        reason=reason,
        metadata_json={"class_id": str(class_id), "student_id": str(student_id)},
    )
    db.commit()
    return True
