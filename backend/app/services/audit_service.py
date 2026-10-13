import uuid
from datetime import datetime, timezone
from typing import Optional, Any
from sqlalchemy.orm import Session
from backend.app.models.audit import AuditLog


def log_audit_event(
    db: Session,
    actor_id: Optional[uuid.UUID],
    action: str,
    target_type: str,
    target_id: Optional[str] = None,
    reason: Optional[str] = None,
    metadata_json: Optional[Any] = None,
) -> AuditLog:
    """Appends an immutable audit event to audit_logs."""
    audit_entry = AuditLog(
        id=uuid.uuid4(),
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        timestamp=datetime.now(timezone.utc),
        reason=reason,
        metadata_json=metadata_json,
    )
    db.add(audit_entry)
    db.flush()
    return audit_entry
