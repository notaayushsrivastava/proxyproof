import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from backend.app.models.enums import DevicePlatform, DeviceStatus, DeviceRequestStatus


class DeviceRegisterRequest(BaseModel):
    public_key: Optional[str] = Field(None, max_length=512)
    platform: DevicePlatform
    device_label: Optional[str] = Field(None, max_length=128)


class DeviceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    public_key: Optional[str]
    platform: DevicePlatform
    device_label: Optional[str]
    status: DeviceStatus
    registered_at: datetime
    last_seen_at: datetime
    revoked_at: Optional[datetime] = None


class DeviceChangeRequestCreate(BaseModel):
    new_device_id: uuid.UUID
    reason: Optional[str] = Field(None, max_length=500)


class DeviceChangeRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    student_id: uuid.UUID
    old_device_id: Optional[uuid.UUID]
    new_device_id: uuid.UUID
    status: DeviceRequestStatus
    reason: Optional[str]
    reviewed_by: Optional[uuid.UUID]
    reviewed_at: Optional[datetime]
    created_at: datetime



class DeviceApprovalAction(BaseModel):
    reason: Optional[str] = Field(None, max_length=500)
