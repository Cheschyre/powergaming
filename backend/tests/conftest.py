"""
Shared test fixtures.

Tests run against an in-memory SQLite database instead of the real
Postgres -- it's fast, needs no setup, and gets wiped clean between every
test. The FastAPI `get_db` dependency is swapped out for one pointing at
this test database via `app.dependency_overrides`, which is the standard
FastAPI pattern for this.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app

TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db


@pytest.fixture(autouse=True)
def _reset_db():
    """Fresh tables before every test, dropped after -- so tests can't leak
    data into each other regardless of order."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)
