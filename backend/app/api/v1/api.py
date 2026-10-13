from fastapi import APIRouter
from backend.app.api.v1.endpoints import (
    auth,
    devices,
    classes,
    admin,
    sessions,
    attendance,
    students,
    websocket,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(devices.router, prefix="/devices", tags=["Devices"])
api_router.include_router(classes.router, prefix="/classes", tags=["Classes"])
api_router.include_router(sessions.router, tags=["Sessions"])
api_router.include_router(attendance.router, tags=["Attendance"])
api_router.include_router(students.router, tags=["Students"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(websocket.router, tags=["WebSocket"])

