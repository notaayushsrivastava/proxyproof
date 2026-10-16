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
from fastapi import FastAPI, Depends, status, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from backend.app.core.config import settings
from backend.app.db.session import get_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("proxyproof")

_static_dir = _backend_dir / "app" / "static"
_templates_dir = _backend_dir / "app" / "templates"


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting ProxyProof API (%s environment)", settings.ENVIRONMENT)
    logger.info(
        "Database target: %s:%s/%s (%s)",
        settings.POSTGRES_HOST,
        settings.POSTGRES_PORT,
        settings.POSTGRES_DB,
        "docker-postgres" if settings.is_development else "remote-postgres",
    )
    try:
        from backend.app.db.base import Base
        from backend.app.db.session import engine
        Base.metadata.create_all(bind=engine)
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(128);"))
            conn.execute(text("ALTER TABLE classes ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;"))
    except Exception as e:
        logger.warning("Auto table initialization notice: %s", e)
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

# Mount Static Assets Directory
if _static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(_static_dir)), name="static")
    app.mount("/backend/static", StaticFiles(directory=str(_static_dir)), name="backend_static")


@app.get("/", tags=["Web"])
def root(request: Request):
    """Serve the ProxyProof landing page for web browsers, or service metadata for JSON API clients."""
    accept = request.headers.get("accept", "")
    if "text/html" in accept or "*/*" in accept or not accept:
        landing_file = _templates_dir / "index.html"
        if landing_file.exists():
            return FileResponse(landing_file, media_type="text/html")
    return {
        "service": settings.PROJECT_NAME,
        "version": "1.0.0",
        "docs_url": "/docs",
        "api_v1": settings.API_V1_STR,
    }


@app.get("/download", response_class=HTMLResponse, tags=["Web"])
def download_page():
    return FileResponse(_templates_dir / "download.html", media_type="text/html")


@app.get("/contact", response_class=HTMLResponse, tags=["Web"])
def contact_page():
    return FileResponse(_templates_dir / "contact.html", media_type="text/html")


@app.get("/privacy", response_class=HTMLResponse, tags=["Web"])
def privacy_page():
    return FileResponse(_templates_dir / "privacy.html", media_type="text/html")


@app.get("/terms", response_class=HTMLResponse, tags=["Web"])
def terms_page():
    return FileResponse(_templates_dir / "terms.html", media_type="text/html")


@app.get("/404", response_class=HTMLResponse, tags=["Web"])
def not_found_page():
    return FileResponse(_templates_dir / "404.html", status_code=404, media_type="text/html")


@app.get("/robots.txt", tags=["SEO"])
def robots_txt():
    return FileResponse(_static_dir / "robots.txt", media_type="text/plain")


@app.get("/sitemap.xml", tags=["SEO"])
def sitemap_xml():
    return FileResponse(_static_dir / "sitemap.xml", media_type="application/xml")


@app.get("/llms.txt", tags=["SEO"])
def llms_txt():
    return FileResponse(_static_dir / "llms.txt", media_type="text/plain; charset=utf-8")


@app.get("/favicon.ico", tags=["Favicon"])
def favicon_ico():
    return FileResponse(_static_dir / "favicon.ico", media_type="image/x-icon")


@app.get("/favicon.svg", tags=["Favicon"])
def favicon_svg():
    return FileResponse(_static_dir / "favicon.svg", media_type="image/svg+xml")


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if exc.status_code == 404:
        if request.url.path.startswith("/api/"):
            return JSONResponse(status_code=404, content={"detail": exc.detail or "Not Found"})
        not_found_file = _templates_dir / "404.html"
        if not_found_file.exists():
            return FileResponse(
                not_found_file,
                status_code=404,
                media_type="text/html",
            )
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})



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

