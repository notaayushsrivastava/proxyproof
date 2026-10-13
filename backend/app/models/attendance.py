import uuid
from datetime import datetime, timezone
from typing import Optional, Any
from sqlalchemy import String, Integer, DateTime, Enum, ForeignKey, UniqueConstraint, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.session import Base
from backend.app.models.enums import AttendanceStatus, AttendanceSource


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    __table_args__ = (
        # Mandatory database-level uniqueness to guarantee idempotency under concurrent retries
        UniqueConstraint("session_id", "student_id", name="uq_session_student_attendance"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("attendance_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[AttendanceStatus] = mapped_column(
        Enum(AttendanceStatus), default=AttendanceStatus.PRESENT, nullable=False, index=True
    )
    source: Mapped[AttendanceSource] = mapped_column(
        Enum(AttendanceSource), default=AttendanceSource.BLE, nullable=False
    )
    marked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    marked_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reason: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True
    )

    # Relationships
    session: Mapped["AttendanceSession"] = relationship("AttendanceSession", back_populates="records")
    student: Mapped["User"] = relationship("User", foreign_keys=[student_id])
    marker: Mapped[Optional["User"]] = relationship("User", foreign_keys=[marked_by])


class AttendanceAttempt(Base):
    __tablename__ = "attendance_attempts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("attendance_sessions.id", ondelete="CASCADE"), nullable=True, index=True
    )
    student_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    device_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("devices.id", ondelete="SET NULL"), nullable=True
    )
    request_id: Mapped[str] = mapped_column(
        String(128), unique=True, index=True, nullable=False
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    outcome_code: Mapped[str] = mapped_column(
        String(64), nullable=False, index=True
    )
    client_rssi_median: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    client_rssi_samples: Mapped[Optional[Any]] = mapped_column(
        JSON, nullable=True
    )
    protocol_version: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    proof_time_slot: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )

    # Relationships
    session: Mapped[Optional["AttendanceSession"]] = relationship("AttendanceSession", back_populates="attempts")
    student: Mapped[Optional["User"]] = relationship("User", foreign_keys=[student_id])
    device: Mapped[Optional["Device"]] = relationship("Device", foreign_keys=[device_id])
