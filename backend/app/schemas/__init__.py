from backend.app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    UserResponse,
    StudentProfileResponse,
)
from backend.app.schemas.device import (
    DeviceRegisterRequest,
    DeviceResponse,
    DeviceChangeRequestCreate,
    DeviceChangeRequestResponse,
    DeviceApprovalAction,
)
from backend.app.schemas.class_schema import (
    ClassCreate,
    ClassResponse,
    RosterMemberResponse,
    AddMemberRequest,
)

__all__ = [
    "LoginRequest",
    "TokenResponse",
    "UserResponse",
    "StudentProfileResponse",
    "DeviceRegisterRequest",
    "DeviceResponse",
    "DeviceChangeRequestCreate",
    "DeviceChangeRequestResponse",
    "DeviceApprovalAction",
    "ClassCreate",
    "ClassResponse",
    "RosterMemberResponse",
    "AddMemberRequest",
]
