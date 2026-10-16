import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from backend.app.schemas.auth import UserResponse


class InstitutionRegisterRequest(BaseModel):
    institution_name: str = Field(..., min_length=2, max_length=255)
    institution_code: str = Field(..., min_length=2, max_length=64)
    domain: str = Field(..., min_length=3, max_length=255)
    admin_name: str = Field(..., min_length=2, max_length=255)
    admin_email: str = Field(..., max_length=255)
    admin_password: str = Field(..., min_length=8, max_length=128)
    department: Optional[str] = Field(None, max_length=128)


class InstitutionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    code: str
    domain: str
    contact_email: str
    department: Optional[str] = None
    hardware_binding_enforced: bool
    attendance_window_seconds: int
    status: str
    created_at: datetime


class InstitutionRegisterResponse(BaseModel):
    institution: InstitutionResponse
    admin_user: UserResponse
    access_token: str
    token_type: str = "bearer"
    message: str = "Institution successfully registered."


class InstitutionUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    department: Optional[str] = Field(None, max_length=128)
    hardware_binding_enforced: Optional[bool] = None
    attendance_window_seconds: Optional[int] = Field(None, ge=5, le=120)


class InstitutionStatsResponse(BaseModel):
    institution: InstitutionResponse
    total_classes: int
    total_faculty: int
    total_students: int
    total_sessions: int
    pending_device_requests: int
