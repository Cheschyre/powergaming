"""Database engine/session setup, shared by the app and by Alembic."""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Falls back to a value that only makes sense for local, non-Docker use --
# inside docker-compose this is always overridden by the DATABASE_URL
# environment variable pointing at the `db` service.
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5432/powergaming",
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency that hands a route a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
