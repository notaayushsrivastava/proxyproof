"""reconstruct_schema_from_scratch

Revision ID: 20261017_reset
Revises: cc9b9e73f6af
Create Date: 2026-10-17 02:05:00.000000

Deletes all existing tables and data, and reconstructs the clean schema from scratch without audit_logs.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20261017_reset'
down_revision: Union[str, Sequence[str], None] = 'cc9b9e73f6af'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Drop all existing tables with CASCADE to completely wipe all existing data
    tables_to_drop = [
        "attendance_records",
        "attendance_attempts",
        "device_change_requests",
        "class_memberships",
        "attendance_sessions",
        "student_profiles",
        "devices",
        "classes",
        "institutions",
        "users",
        "audit_logs",
    ]
    for tbl in tables_to_drop:
        conn.execute(sa.text(f"DROP TABLE IF EXISTS {tbl} CASCADE"))

    # 2. Ensure PostgreSQL enum types exist cleanly
    enums = [
        ("userrole", ("STUDENT", "ORGANIZER", "ADMIN")),
        ("accountstatus", ("ACTIVE", "SUSPENDED", "DISABLED")),
        ("deviceplatform", ("IOS", "ANDROID", "OTHER")),
        ("devicestatus", ("PENDING", "ACTIVE", "REVOKED")),
        ("devicerequeststatus", ("PENDING", "APPROVED", "REJECTED", "CANCELLED")),
        ("sessionstatus", ("ACTIVE", "CLOSED", "EXPIRED")),
        ("attendancestatus", ("PRESENT", "MANUAL_PRESENT", "EXCUSED", "REMOVED")),
        ("attendancesource", ("BLE", "MANUAL", "ADMIN")),
    ]
    for enum_name, values in enums:
        val_str = ", ".join(f"'{v}'" for v in values)
        conn.execute(sa.text(f"""
            DO $$ BEGIN
                CREATE TYPE {enum_name} AS ENUM ({val_str});
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """))

    # 3. Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', sa.Enum('STUDENT', 'ORGANIZER', 'ADMIN', name='userrole', create_type=False), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=False),
        sa.Column('department', sa.String(length=128), nullable=True),
        sa.Column('institution_id', sa.Uuid(), nullable=True),
        sa.Column('account_status', sa.Enum('ACTIVE', 'SUSPENDED', 'DISABLED', name='accountstatus', create_type=False), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_role'), 'users', ['role'], unique=False)
    op.create_index(op.f('ix_users_institution_id'), 'users', ['institution_id'], unique=False)

    # 4. Create institutions table
    op.create_table(
        'institutions',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('code', sa.String(length=64), nullable=False),
        sa.Column('domain', sa.String(length=255), nullable=False),
        sa.Column('contact_email', sa.String(length=255), nullable=False),
        sa.Column('department', sa.String(length=128), nullable=True),
        sa.Column('admin_user_id', sa.Uuid(), nullable=False),
        sa.Column('hardware_binding_enforced', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('attendance_window_seconds', sa.Integer(), nullable=False, server_default=sa.text('15')),
        sa.Column('status', sa.String(length=32), nullable=False, server_default=sa.text("'active'")),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['admin_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_institutions_code'), 'institutions', ['code'], unique=True)
    op.create_index(op.f('ix_institutions_domain'), 'institutions', ['domain'], unique=False)
    op.create_index(op.f('ix_institutions_admin_user_id'), 'institutions', ['admin_user_id'], unique=False)

    # 5. Link users.institution_id foreign key
    op.create_foreign_key(
        'fk_users_institution_id_institutions',
        'users',
        'institutions',
        ['institution_id'],
        ['id'],
        ondelete='SET NULL',
    )

    # 6. Create student_profiles table
    op.create_table(
        'student_profiles',
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('student_number', sa.String(length=64), nullable=False),
        sa.Column('department', sa.String(length=128), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id'),
    )
    op.create_index(op.f('ix_student_profiles_student_number'), 'student_profiles', ['student_number'], unique=True)

    # 7. Create classes table
    op.create_table(
        'classes',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('code', sa.String(length=64), nullable=False),
        sa.Column('owner_organizer_id', sa.Uuid(), nullable=False),
        sa.Column('institution_id', sa.Uuid(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['owner_organizer_id'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['institution_id'], ['institutions.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_classes_code'), 'classes', ['code'], unique=True)
    op.create_index(op.f('ix_classes_owner_organizer_id'), 'classes', ['owner_organizer_id'], unique=False)
    op.create_index(op.f('ix_classes_institution_id'), 'classes', ['institution_id'], unique=False)

    # 8. Create class_memberships table
    op.create_table(
        'class_memberships',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('class_id', sa.Uuid(), nullable=False),
        sa.Column('student_id', sa.Uuid(), nullable=False),
        sa.Column('joined_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['class_id'], ['classes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('class_id', 'student_id', name='uq_class_student_membership'),
    )
    op.create_index(op.f('ix_class_memberships_class_id'), 'class_memberships', ['class_id'], unique=False)
    op.create_index(op.f('ix_class_memberships_student_id'), 'class_memberships', ['student_id'], unique=False)

    # 9. Create devices table
    op.create_table(
        'devices',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('public_key', sa.String(length=512), nullable=True),
        sa.Column('platform', sa.Enum('IOS', 'ANDROID', 'OTHER', name='deviceplatform', create_type=False), nullable=False),
        sa.Column('device_label', sa.String(length=128), nullable=True),
        sa.Column('status', sa.Enum('PENDING', 'ACTIVE', 'REVOKED', name='devicestatus', create_type=False), nullable=False),
        sa.Column('registered_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_devices_status'), 'devices', ['status'], unique=False)
    op.create_index(op.f('ix_devices_user_id'), 'devices', ['user_id'], unique=False)
    op.create_index(
        'uq_one_active_device_per_student',
        'devices',
        ['user_id'],
        unique=True,
        postgresql_where=sa.text("status = 'ACTIVE'"),
    )

    # 10. Create attendance_sessions table
    op.create_table(
        'attendance_sessions',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('class_id', sa.Uuid(), nullable=False),
        sa.Column('organizer_id', sa.Uuid(), nullable=False),
        sa.Column('status', sa.Enum('ACTIVE', 'CLOSED', 'EXPIRED', name='sessionstatus', create_type=False), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ends_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('beacon_secret_ciphertext', sa.String(length=512), nullable=False),
        sa.Column('protocol_version', sa.Integer(), nullable=False),
        sa.Column('notes', sa.String(length=500), nullable=True),
        sa.Column('proximity_threshold', sa.Integer(), nullable=False),
        sa.CheckConstraint('ends_at > started_at', name='chk_session_ends_after_start'),
        sa.ForeignKeyConstraint(['class_id'], ['classes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['organizer_id'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_attendance_sessions_class_id'), 'attendance_sessions', ['class_id'], unique=False)
    op.create_index(op.f('ix_attendance_sessions_ends_at'), 'attendance_sessions', ['ends_at'], unique=False)
    op.create_index(op.f('ix_attendance_sessions_organizer_id'), 'attendance_sessions', ['organizer_id'], unique=False)
    op.create_index(op.f('ix_attendance_sessions_status'), 'attendance_sessions', ['status'], unique=False)

    # 11. Create device_change_requests table
    op.create_table(
        'device_change_requests',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('student_id', sa.Uuid(), nullable=False),
        sa.Column('old_device_id', sa.Uuid(), nullable=True),
        sa.Column('new_device_id', sa.Uuid(), nullable=False),
        sa.Column('status', sa.Enum('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', name='devicerequeststatus', create_type=False), nullable=False),
        sa.Column('reason', sa.String(length=500), nullable=True),
        sa.Column('reviewed_by', sa.Uuid(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['new_device_id'], ['devices.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['old_device_id'], ['devices.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['reviewed_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_device_change_requests_status'), 'device_change_requests', ['status'], unique=False)
    op.create_index(op.f('ix_device_change_requests_student_id'), 'device_change_requests', ['student_id'], unique=False)

    # 12. Create attendance_attempts table
    op.create_table(
        'attendance_attempts',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('session_id', sa.Uuid(), nullable=True),
        sa.Column('student_id', sa.Uuid(), nullable=True),
        sa.Column('device_id', sa.Uuid(), nullable=True),
        sa.Column('request_id', sa.String(length=128), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('outcome_code', sa.String(length=64), nullable=False),
        sa.Column('client_rssi_median', sa.Integer(), nullable=True),
        sa.Column('client_rssi_samples', sa.JSON(), nullable=True),
        sa.Column('protocol_version', sa.Integer(), nullable=True),
        sa.Column('proof_time_slot', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['session_id'], ['attendance_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_attendance_attempts_outcome_code'), 'attendance_attempts', ['outcome_code'], unique=False)
    op.create_index(op.f('ix_attendance_attempts_request_id'), 'attendance_attempts', ['request_id'], unique=True)
    op.create_index(op.f('ix_attendance_attempts_session_id'), 'attendance_attempts', ['session_id'], unique=False)
    op.create_index(op.f('ix_attendance_attempts_student_id'), 'attendance_attempts', ['student_id'], unique=False)
    op.create_index(op.f('ix_attendance_attempts_timestamp'), 'attendance_attempts', ['timestamp'], unique=False)

    # 13. Create attendance_records table
    op.create_table(
        'attendance_records',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('session_id', sa.Uuid(), nullable=False),
        sa.Column('student_id', sa.Uuid(), nullable=False),
        sa.Column('status', sa.Enum('PRESENT', 'MANUAL_PRESENT', 'EXCUSED', 'REMOVED', name='attendancestatus', create_type=False), nullable=False),
        sa.Column('source', sa.Enum('BLE', 'MANUAL', 'ADMIN', name='attendancesource', create_type=False), nullable=False),
        sa.Column('marked_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('marked_by', sa.Uuid(), nullable=True),
        sa.Column('reason', sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(['marked_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['session_id'], ['attendance_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('session_id', 'student_id', name='uq_session_student_attendance'),
    )
    op.create_index(op.f('ix_attendance_records_session_id'), 'attendance_records', ['session_id'], unique=False)
    op.create_index(op.f('ix_attendance_records_status'), 'attendance_records', ['status'], unique=False)
    op.create_index(op.f('ix_attendance_records_student_id'), 'attendance_records', ['student_id'], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    tables = [
        "attendance_records",
        "attendance_attempts",
        "device_change_requests",
        "class_memberships",
        "attendance_sessions",
        "student_profiles",
        "devices",
        "classes",
        "institutions",
        "users",
    ]
    for tbl in tables:
        conn.execute(sa.text(f"DROP TABLE IF EXISTS {tbl} CASCADE"))
