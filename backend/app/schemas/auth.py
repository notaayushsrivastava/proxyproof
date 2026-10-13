import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from backend.app.models.enums import UserRole, AccountStatus


class LoginRequest(BaseModel):
    email: str = Field(..., max_length=255)
    password: str


class StudentProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    student_number: str
    department: Optional[str] = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    role: UserRole
    full_name: str
    account_status: AccountStatus
    student_profile: Optional[StudentProfileResponse] = None
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
