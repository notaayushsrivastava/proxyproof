from fastapi import APIRouter
from backend.app.api.v1.endpoints import auth, devices, classes, admin

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(devices.router, prefix="/devices", tags=["Devices"])
api_router.include_router(classes.router, prefix="/classes", tags=["Classes"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
