import uuid
import re
import csv
import io
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
from backend.app.models.enums import UserRole, AccountStatus, DeviceRequestStatus
from backend.app.schemas.institution import (
    InstitutionRegisterRequest,
    InstitutionRegisterResponse,
    InstitutionResponse,
    InstitutionUpdateRequest,
    InstitutionStatsResponse,
    FacultyCreateRequest,
    FacultyResponse,
    BulkCsvRequest,
    BulkFacultyOperationResult,
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

    admin_user.institution_id = institution.id
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
    if not institution and current_admin.institution_id:
        institution = db.query(Institution).filter(Institution.id == current_admin.institution_id).first()
    if not institution:
        institution = db.query(Institution).order_by(Institution.created_at.desc()).first()

    if not institution:
        # Create a default system institution if none exists yet
        institution = Institution(
            id=uuid.uuid4(),
            name="University of Technology",
            code="UNIV",
            domain="university.local",
            contact_email=current_admin.email,
            admin_user_id=current_admin.id,
            hardware_binding_enforced=True,
            attendance_window_seconds=15,
            status="active",
        )
        db.add(institution)
        db.commit()
        db.refresh(institution)

    # Strictly scope counts to the admin's institution
    total_classes = db.query(Class).filter(Class.institution_id == institution.id).count()
    faculty_members = (
        db.query(User)
        .filter(
            User.role == UserRole.ORGANIZER,
            (User.institution_id == institution.id) | (User.email.ilike(f"%@{institution.domain}")),
        )
        .order_by(User.created_at.desc())
        .all()
    )
    total_faculty = len(faculty_members)

    total_students = (
        db.query(User)
        .filter(
            User.role == UserRole.STUDENT,
            (User.institution_id == institution.id) | (User.email.ilike(f"%@{institution.domain}")),
        )
        .count()
    )

    total_sessions = (
        db.query(AttendanceSession)
        .join(Class, AttendanceSession.class_id == Class.id)
        .filter(Class.institution_id == institution.id)
        .count()
    )

    pending_devices = (
        db.query(DeviceChangeRequest)
        .join(User, DeviceChangeRequest.student_id == User.id)
        .filter(
            DeviceChangeRequest.status == DeviceRequestStatus.PENDING,
            (User.institution_id == institution.id) | (User.email.ilike(f"%@{institution.domain}")),
        )
        .count()
    )

    return InstitutionStatsResponse(
        institution=institution,
        total_classes=total_classes,
        total_faculty=total_faculty,
        total_students=total_students,
        total_sessions=total_sessions,
        pending_device_requests=pending_devices,
        broadcasters=[FacultyResponse.model_validate(f) for f in faculty_members],
    )


@router.get("/list", response_model=List[InstitutionResponse])
def list_institutions(db: Session = Depends(get_db)):
    """Returns a directory of registered institutions on the platform."""
    return db.query(Institution).filter(Institution.status == "active").order_by(Institution.name.asc()).all()


@router.get("/faculty", response_model=List[FacultyResponse])
def list_institution_faculty(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Lists all faculty members associated with the administrator's institution."""
    institution = db.query(Institution).filter(Institution.admin_user_id == current_admin.id).first()
    if not institution and current_admin.institution_id:
        institution = db.query(Institution).filter(Institution.id == current_admin.institution_id).first()
    if not institution:
        institution = db.query(Institution).order_by(Institution.created_at.desc()).first()

    query = db.query(User).filter(User.role == UserRole.ORGANIZER)
    if institution:
        query = query.filter(
            (User.institution_id == institution.id) |
            (User.email.ilike(f"%@{institution.domain}"))
        )
    return query.order_by(User.created_at.desc()).all()


@router.post("/faculty", response_model=FacultyResponse, status_code=status.HTTP_201_CREATED)
def create_faculty_member(
    payload: FacultyCreateRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Creates a single faculty/instructor account under the administrator's institution."""
    email = payload.email.strip().lower()
    existing = db.query(User).filter(func.lower(User.email) == email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An account with email '{email}' already exists.",
        )

    institution = db.query(Institution).filter(Institution.admin_user_id == current_admin.id).first()
    if not institution and current_admin.institution_id:
        institution = db.query(Institution).filter(Institution.id == current_admin.institution_id).first()
    if not institution:
        institution = db.query(Institution).order_by(Institution.created_at.desc()).first()

    raw_password = payload.password if payload.password else "FacultyPass@2026"
    faculty = User(
        id=uuid.uuid4(),
        email=email,
        password_hash=hash_password(raw_password),
        role=UserRole.ORGANIZER,
        full_name=payload.full_name.strip(),
        department=payload.department.strip() if payload.department else (institution.department if institution else None),
        institution_id=institution.id if institution else None,
        account_status=AccountStatus.ACTIVE,
    )
    db.add(faculty)
    db.commit()
    db.refresh(faculty)
    return faculty


@router.post("/faculty/bulk-csv", response_model=BulkFacultyOperationResult)
def bulk_upload_faculty_csv(
    payload: BulkCsvRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Parses a CSV text payload and creates faculty members in bulk."""
    institution = db.query(Institution).filter(Institution.admin_user_id == current_admin.id).first()
    if not institution and current_admin.institution_id:
        institution = db.query(Institution).filter(Institution.id == current_admin.institution_id).first()
    if not institution:
        institution = db.query(Institution).order_by(Institution.created_at.desc()).first()

    csv_text = payload.csv_content.strip()
    if not csv_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV content cannot be empty.",
        )

    reader = csv.reader(io.StringIO(csv_text))
    created_list = []
    errors = []
    created_count = 0
    failed_count = 0

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
            normalized_first in ["name", "full_name", "fullname", "faculty_name", "faculty", "email"]
            or not has_email
        ):
            header_skipped = True
            continue

        if len(clean_row) < 2:
            errors.append(f"Row {row_idx}: Insufficient columns. Need at least Name and Email.")
            failed_count += 1
            continue

        if "@" in clean_row[0] and "@" not in clean_row[1]:
            email = clean_row[0].lower()
            name = clean_row[1]
            dept = clean_row[2] if len(clean_row) > 2 and clean_row[2] else None
            pwd = clean_row[3] if len(clean_row) > 3 and clean_row[3] else "FacultyPass@2026"
        else:
            name = clean_row[0]
            email = clean_row[1].lower()
            dept = clean_row[2] if len(clean_row) > 2 and clean_row[2] else None
            pwd = clean_row[3] if len(clean_row) > 3 and clean_row[3] else "FacultyPass@2026"

        if not email or "@" not in email:
            errors.append(f"Row {row_idx}: Invalid email '{email}'.")
            failed_count += 1
            continue

        if not name:
            errors.append(f"Row {row_idx}: Name cannot be empty.")
            failed_count += 1
            continue

        # Check existing email
        existing = db.query(User).filter(func.lower(User.email) == email).first()
        if existing:
            errors.append(f"Row {row_idx}: Account with email '{email}' already exists (skipped).")
            failed_count += 1
            continue

        try:
            faculty = User(
                id=uuid.uuid4(),
                email=email,
                password_hash=hash_password(pwd),
                role=UserRole.ORGANIZER,
                full_name=name,
                department=dept or (institution.department if institution else None),
                institution_id=institution.id if institution else None,
                account_status=AccountStatus.ACTIVE,
            )
            db.add(faculty)
            db.flush()
            created_list.append(faculty)
            created_count += 1
        except Exception as exc:
            errors.append(f"Row {row_idx}: Error creating '{email}': {str(exc)}")
            failed_count += 1

    if created_count > 0:
        db.commit()
        for f in created_list:
            db.refresh(f)

    return BulkFacultyOperationResult(
        created_count=created_count,
        failed_count=failed_count,
        errors=errors,
        faculty=[FacultyResponse.model_validate(f) for f in created_list],
        message=f"Successfully provisioned {created_count} faculty account(s)."
        + (f" {failed_count} row(s) had errors or were skipped." if failed_count > 0 else ""),
    )
