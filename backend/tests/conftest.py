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
