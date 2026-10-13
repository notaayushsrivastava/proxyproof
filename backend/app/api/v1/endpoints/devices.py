import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.core.dependencies import get_current_student
from backend.app.models.user import User
from backend.app.models.device import Device, DeviceChangeRequest
from backend.app.schemas.device import (
    DeviceRegisterRequest,
    DeviceResponse,
    DeviceChangeRequestCreate,
    DeviceChangeRequestResponse,
)
from backend.app.services.device_service import register_device, request_device_change

router = APIRouter()


@router.post("/register", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
def register_my_device(
    payload: DeviceRegisterRequest,
    current_student: User = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """Registers a student's device. Auto-activates first device, or registers as pending."""
    device = register_device(
        db=db,
        user_id=current_student.id,
        platform=payload.platform,
        public_key=payload.public_key,
        device_label=payload.device_label,
    )
    return device


@router.get("/me", response_model=List[DeviceResponse])
def get_my_devices(
    current_student: User = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """Returns all devices registered by the current student."""
    return db.query(Device).filter(Device.user_id == current_student.id).all()


@router.post("/change-requests", response_model=DeviceChangeRequestResponse, status_code=status.HTTP_201_CREATED)
def submit_device_change_request(
    payload: DeviceChangeRequestCreate,
    current_student: User = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """Requests replacement of student's current active device with a pending device."""
    return request_device_change(
        db=db,
        student_id=current_student.id,
        new_device_id=payload.new_device_id,
        reason=payload.reason,
    )


@router.get("/change-requests/me", response_model=List[DeviceChangeRequestResponse])
def get_my_change_requests(
    current_student: User = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """Returns all device change requests filed by the student."""
    return (
        db.query(DeviceChangeRequest)
        .filter(DeviceChangeRequest.student_id == current_student.id)
        .order_by(DeviceChangeRequest.created_at.desc())
        .all()
    )
