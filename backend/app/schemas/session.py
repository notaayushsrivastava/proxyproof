import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
from backend.app.models.enums import SessionStatus


class SessionCreate(BaseModel):
    duration_minutes: int = Field(5, ge=1, le=60)
    notes: Optional[str] = Field(None, max_length=500)
    proximity_threshold: int = Field(-75, ge=-100, le=-30)


class SessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    class_id: uuid.UUID
    organizer_id: uuid.UUID
    status: SessionStatus
    started_at: datetime
    ends_at: datetime
    closed_at: Optional[datetime] = None
    protocol_version: int
    notes: Optional[str] = None
    proximity_threshold: int


class OrganizerSessionStartResponse(SessionResponse):
    session_secret: str
    proof_validity_seconds: int = 5


class ActiveSessionStudentView(BaseModel):
    id: uuid.UUID
    class_id: uuid.UUID
    class_name: str
    class_code: str
    started_at: datetime
    ends_at: datetime
    proximity_threshold: int
    protocol_version: int
    current_token: Optional[str] = None
    current_time_slot: Optional[int] = None

