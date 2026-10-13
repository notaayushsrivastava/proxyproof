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
