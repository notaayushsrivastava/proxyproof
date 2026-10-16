import uuid
from typing import Optional, Any
from sqlalchemy.orm import Session


def log_audit_event(
    db: Session,
    actor_id: Optional[uuid.UUID] = None,
    action: str = "",
    target_type: str = "",
    target_id: Optional[str] = None,
    reason: Optional[str] = None,
    metadata_json: Optional[Any] = None,
) -> None:
    """No-op: Institutional audit logging has been decommissioned."""
    return None
