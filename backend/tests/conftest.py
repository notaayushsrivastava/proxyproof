import sys
from pathlib import Path

# Ensure repository root is on sys.path
_current_dir = Path(__file__).resolve().parent
_backend_dir = _current_dir.parent
_repo_root = _backend_dir.parent

for _p in [str(_repo_root), str(_backend_dir)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

import pytest
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient
from backend.app.db.session import SessionLocal
from backend.app.main import app


@pytest.fixture(scope="session")
def db_session() -> Session:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="module")
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client
