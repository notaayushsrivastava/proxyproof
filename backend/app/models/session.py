import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import String, Integer, DateTime, Enum, ForeignKey, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.session import Base
from backend.app.models.enums import SessionStatus


class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"
    __table_args__ = (
        CheckConstraint("ends_at > started_at", name="chk_session_ends_after_start"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    class_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    organizer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus), default=SessionStatus.ACTIVE, nullable=False, index=True
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    ends_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    closed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    beacon_secret_ciphertext: Mapped[str] = mapped_column(
        String(512), nullable=False
    )
    protocol_version: Mapped[int] = mapped_column(
        Integer, default=1, nullable=False
    )
    notes: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True
    )
    proximity_threshold: Mapped[int] = mapped_column(
        Integer, default=-75, nullable=False
    )

    # Relationships
    classroom: Mapped["Class"] = relationship("Class", back_populates="sessions")
    organizer: Mapped["User"] = relationship("User", foreign_keys=[organizer_id])
    records: Mapped[List["AttendanceRecord"]] = relationship(
        "AttendanceRecord", back_populates="session", cascade="all, delete-orphan"
    )
    attempts: Mapped[List["AttendanceAttempt"]] = relationship(
        "AttendanceAttempt", back_populates="session", cascade="all, delete-orphan"
    )
