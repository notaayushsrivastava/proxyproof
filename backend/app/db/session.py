from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from backend.app.core.config import settings

# Normalize DATABASE_URL for sync connection if needed
sync_database_url = settings.DATABASE_URL
if "postgresql+asyncpg://" in sync_database_url:
    sync_database_url = sync_database_url.replace("postgresql+asyncpg://", "postgresql+psycopg://")

engine = create_engine(
    sync_database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dependency that yields a database session and safely closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
