import uuid
import re
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.db.session import get_db
from backend.app.core.security import hash_password, create_access_token
from backend.app.core.dependencies import get_current_user, get_current_admin
from backend.app.models.user import User
from backend.app.models.institution import Institution
from backend.app.models.class_model import Class
from backend.app.models.session import AttendanceSession
from backend.app.models.device import DeviceChangeRequest
from backend.app.models.audit import AuditLog
from backend.app.models.enums import UserRole, AccountStatus, DeviceRequestStatus
from backend.app.schemas.institution import (
    InstitutionRegisterRequest,
    InstitutionRegisterResponse,
    InstitutionResponse,
    InstitutionUpdateRequest,
    InstitutionStatsResponse,
)

router = APIRouter()


@router.post("/register", response_model=InstitutionRegisterResponse, status_code=status.HTTP_201_CREATED)
def register_institution(request: InstitutionRegisterRequest, db: Session = Depends(get_db)):
    """Registers a new university/college institution, provisions its administrator account,

    and returns instant access tokens for management.
    """
    admin_email = request.admin_email.strip().lower()
    clean_code = re.sub(r"[^A-Za-z0-9_-]", "", request.institution_code.strip()).upper()

    if not clean_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Institution code must contain alphanumeric characters.",
        )

    # Check existing user
    existing_user = db.query(User).filter(func.lower(User.email) == admin_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An account with email '{admin_email}' is already registered.",
        )

    # Check existing institution code
    existing_inst = db.query(Institution).filter(Institution.code == clean_code).first()
    if existing_inst:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Institution code '{clean_code}' is already claimed by {existing_inst.name}.",
        )

    # Create Institution Admin User
    admin_user = User(
        id=uuid.uuid4(),
        email=admin_email,
        password_hash=hash_password(request.admin_password),
        role=UserRole.ADMIN,
        full_name=request.admin_name.strip(),
        account_status=AccountStatus.ACTIVE,
    )
    db.add(admin_user)
    db.flush()

    # Create Institution Record
    clean_domain = request.domain.strip().lower()
    if clean_domain.startswith("http://") or clean_domain.startswith("https://"):
        clean_domain = clean_domain.split("://", 1)[1].split("/")[0]

    institution = Institution(
        id=uuid.uuid4(),
        name=request.institution_name.strip(),
        code=clean_code,
        domain=clean_domain,
        contact_email=admin_email,
        department=request.department.strip() if request.department else None,
        admin_user_id=admin_user.id,
        hardware_binding_enforced=True,
        attendance_window_seconds=15,
        status="active",
    )
    db.add(institution)
    db.flush()

    # Record Audit Event
    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=admin_user.id,
        action="REGISTER_INSTITUTION",
        target_type="institution",
        target_id=str(institution.id),
        reason=f"Registered campus institution {institution.name} ({clean_code})",
    )
    db.add(audit)
    db.commit()
    db.refresh(admin_user)
    db.refresh(institution)

    # Issue management JWT token
    access_token = create_access_token(subject=admin_user.id, role=admin_user.role.value)

    return InstitutionRegisterResponse(
        institution=institution,
        admin_user=admin_user,
        access_token=access_token,
        token_type="bearer",
        message=f"{institution.name} registered successfully with campus administrator access.",
    )


@router.get("/me", response_model=InstitutionResponse)
def get_my_institution(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves the institution associated with the currently authenticated user."""
    # 1. Check if user is an admin of an institution
    institution = db.query(Institution).filter(Institution.admin_user_id == current_user.id).first()
    if not institution:
        # 2. Check by email domain
        email_domain = current_user.email.split("@")[-1].lower() if "@" in current_user.email else ""
        if email_domain:
            institution = db.query(Institution).filter(Institution.domain == email_domain).first()

    # 3. Fallback: most recent active institution
    if not institution:
        institution = db.query(Institution).order_by(Institution.created_at.desc()).first()

    if not institution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No institution profile found for this campus account.",
        )
    return institution


@router.patch("/me", response_model=InstitutionResponse)
def update_institution_settings(
    payload: InstitutionUpdateRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Updates security and attendance policies for the administrator's institution."""
    institution = db.query(Institution).filter(Institution.admin_user_id == current_admin.id).first()
    if not institution:
        institution = db.query(Institution).order_by(Institution.created_at.desc()).first()

    if not institution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Institution profile not found.",
        )

    if payload.name is not None:
        institution.name = payload.name.strip()
    if payload.department is not None:
        institution.department = payload.department.strip()
    if payload.hardware_binding_enforced is not None:
        institution.hardware_binding_enforced = payload.hardware_binding_enforced
    if payload.attendance_window_seconds is not None:
        institution.attendance_window_seconds = payload.attendance_window_seconds

    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=current_admin.id,
        action="UPDATE_INSTITUTION_POLICY",
        target_type="institution",
        target_id=str(institution.id),
        reason="Updated institutional attendance rules and hardware policies",
    )
    db.add(audit)
    db.commit()
    db.refresh(institution)
    return institution


@router.get("/overview", response_model=InstitutionStatsResponse)
def get_institution_overview(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Provides high-level management telemetry across classes, faculty, students, and device binding queues."""
    institution = db.query(Institution).filter(Institution.admin_user_id == current_admin.id).first()
    if not institution:
        institution = db.query(Institution).order_by(Institution.created_at.desc()).first()

    if not institution:
        # Create a default system institution if none exists yet
        institution = Institution(
            id=uuid.uuid4(),
            name="ProxyProof Academic System",
            code="PROXYPROOF",
            domain="proxyproof.local",
            contact_email=current_admin.email,
            admin_user_id=current_admin.id,
            hardware_binding_enforced=True,
            attendance_window_seconds=15,
            status="active",
        )
        db.add(institution)
        db.commit()
        db.refresh(institution)

    total_classes = db.query(Class).count()
    total_faculty = db.query(User).filter(User.role == UserRole.ORGANIZER).count()
    total_students = db.query(User).filter(User.role == UserRole.STUDENT).count()
    total_sessions = db.query(AttendanceSession).count()
    pending_devices = db.query(DeviceChangeRequest).filter(
        DeviceChangeRequest.status == DeviceRequestStatus.PENDING
    ).count()

    return InstitutionStatsResponse(
        institution=institution,
        total_classes=total_classes,
        total_faculty=total_faculty,
        total_students=total_students,
        total_sessions=total_sessions,
        pending_device_requests=pending_devices,
    )


@router.get("/list", response_model=List[InstitutionResponse])
def list_institutions(db: Session = Depends(get_db)):
    """Returns a directory of registered institutions on the platform."""
    return db.query(Institution).filter(Institution.status == "active").order_by(Institution.name.asc()).all()
