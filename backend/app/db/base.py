# Import Base and all models so Alembic's target_metadata can discover them
from backend.app.db.session import Base
from backend.app.models import (
    User,
    StudentProfile,
    Class,
    ClassMembership,
    Device,
    DeviceChangeRequest,
    AttendanceSession,
    AttendanceRecord,
    AttendanceAttempt,
    AuditLog,
)

__all__ = ["Base"]
