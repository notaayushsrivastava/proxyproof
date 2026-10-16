from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from backend.app.core.config import settings

import os
from sqlalchemy.pool import NullPool

# Normalize DATABASE_URL for sync connection if needed
sync_database_url = settings.DATABASE_URL
if "postgresql+asyncpg://" in sync_database_url:
    sync_database_url = sync_database_url.replace("postgresql+asyncpg://", "postgresql+psycopg://")

# In Vercel serverless functions, NullPool prevents exhausting database connection limits
is_serverless = os.getenv("VERCEL") == "1" or os.getenv("AWS_LAMBDA_FUNCTION_NAME") is not None
engine_kwargs = {"pool_pre_ping": True}

if is_serverless:
    engine_kwargs["poolclass"] = NullPool
else:
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20

engine = create_engine(sync_database_url, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dependency that yields a database session and safely closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
