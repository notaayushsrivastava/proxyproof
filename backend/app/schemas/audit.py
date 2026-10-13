import uuid
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    actor_id: Optional[uuid.UUID]
    action: str
    target_type: str
    target_id: Optional[str]
    timestamp: datetime
    reason: Optional[str]
    metadata_json: Optional[Any] = None
