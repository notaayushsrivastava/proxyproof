import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


class ClassCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    code: str = Field(..., min_length=2, max_length=64)


class ClassResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    code: str
    owner_organizer_id: uuid.UUID
    created_at: datetime
    archived_at: Optional[datetime] = None


class RosterMemberResponse(BaseModel):
    student_id: uuid.UUID
    email: str
    full_name: str
    student_number: Optional[str] = None
    joined_at: datetime


class AddMemberRequest(BaseModel):
    student_id: uuid.UUID


class StudentCreateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    email: str = Field(..., max_length=255)
    student_number: str = Field(..., min_length=1, max_length=64)
    department: Optional[str] = Field(None, max_length=128)
    password: Optional[str] = Field(None, min_length=6, max_length=128)
    class_id: Optional[uuid.UUID] = None


class StudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: str
    student_number: Optional[str] = None
    department: Optional[str] = None
    role: str
    account_status: str
    created_at: datetime


class BulkStudentCsvRequest(BaseModel):
    csv_content: str
    class_id: Optional[uuid.UUID] = None


class BulkStudentOperationResult(BaseModel):
    created_count: int
    enrolled_count: int
    failed_count: int
    errors: list[str] = []
    message: str
