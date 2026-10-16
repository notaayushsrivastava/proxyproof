import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, DateTime, Boolean, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.session import Base


class Institution(Base):
    __tablename__ = "institutions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    domain: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    contact_email: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    admin_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    hardware_binding_enforced: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    attendance_window_seconds: Mapped[int] = mapped_column(Integer, default=15, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    admin_user: Mapped["User"] = relationship("User", foreign_keys=[admin_user_id])
