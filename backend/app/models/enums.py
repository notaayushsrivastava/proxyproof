import enum


class UserRole(str, enum.Enum):
    STUDENT = "student"
    ORGANIZER = "organizer"
    ADMIN = "admin"


class AccountStatus(str, enum.Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    DISABLED = "disabled"


class DevicePlatform(str, enum.Enum):
    IOS = "ios"
    ANDROID = "android"
    OTHER = "other"


class DeviceStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    REVOKED = "revoked"


class DeviceRequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class SessionStatus(str, enum.Enum):
    ACTIVE = "active"
    CLOSED = "closed"
    EXPIRED = "expired"


class AttendanceStatus(str, enum.Enum):
    PRESENT = "present"
    MANUAL_PRESENT = "manual_present"
    EXCUSED = "excused"
    REMOVED = "removed"


class AttendanceSource(str, enum.Enum):
    BLE = "ble"
    MANUAL = "manual"
    ADMIN = "admin"
