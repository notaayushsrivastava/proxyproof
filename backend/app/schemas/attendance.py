import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
from backend.app.models.enums import AttendanceStatus, AttendanceSource


class AttendanceAttemptRequest(BaseModel):
    proof: str = Field(..., min_length=32, max_length=64)
    time_slot: int
    request_id: str = Field(..., max_length=128)
    rssi_median: int = Field(..., ge=-120, le=0)
    rssi_samples: Optional[List[int]] = None
    device_signature: Optional[str] = None


class AttendanceAttemptResponse(BaseModel):
    outcome_code: str
    message: str
    session_id: uuid.UUID
    student_id: uuid.UUID
    status: Optional[AttendanceStatus] = None
    marked_at: Optional[datetime] = None


class ManualAttendanceRequest(BaseModel):
    student_id: uuid.UUID
    action: AttendanceStatus = AttendanceStatus.MANUAL_PRESENT
    reason: str = Field(..., min_length=3, max_length=500)


class AttendanceRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    student_id: uuid.UUID
    student_name: Optional[str] = None
    student_number: Optional[str] = None
    student_email: Optional[str] = None
    status: AttendanceStatus
    source: AttendanceSource
    marked_at: datetime
    marked_by: Optional[uuid.UUID] = None
    reason: Optional[str] = None


class ClassAttendanceSummary(BaseModel):
    class_id: uuid.UUID
    class_name: str
    class_code: str
    attended_sessions: int
    total_completed_sessions: int
    percentage: float


class StudentAttendanceHistoryItem(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    class_id: uuid.UUID
    class_name: str
    class_code: str
    session_date: datetime
    status: AttendanceStatus
    source: AttendanceSource
    marked_at: datetime
    reason: Optional[str] = None
