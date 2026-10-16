import sys
from pathlib import Path

# Ensure repository root and backend directory are always on sys.path
_current_dir = Path(__file__).resolve().parent
_backend_dir = _current_dir.parent
_repo_root = _backend_dir.parent

for _p in [str(_repo_root), str(_backend_dir)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from backend.app.core.config import settings
from backend.app.db.session import get_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("proxyproof")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting ProxyProof API (%s environment)", settings.ENVIRONMENT)
    yield
    logger.info("Shutting down ProxyProof API")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="ProxyProof — Bluetooth Attendance API Service",
    openapi_url="/api/v1/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Root"])
def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": "1.0.0",
        "docs_url": "/docs",
        "api_v1": settings.API_V1_STR,
    }


@app.get("/health", tags=["Health"])
@app.get("/api/v1/health", tags=["Health"])
def health_check(db: Session = Depends(get_db)):
    """Readiness endpoint verifying database connectivity without leaking credentials."""
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected",
            "environment": settings.ENVIRONMENT,
        }
    except Exception as exc:
        logger.error("Database health check failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        )


# Include Versioned API Routers
from backend.app.api.v1.api import api_router

app.include_router(api_router, prefix=settings.API_V1_STR)

