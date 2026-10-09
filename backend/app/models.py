"""SQLAlchemy ORM models."""

from sqlalchemy import JSON, Column, DateTime, Integer, String
from sqlalchemy.sql import func

from app.db import Base


class Build(Base):
    """A saved round of attacks -- the persisted version of the `attacks`
    list /api/calculate takes as a one-off request body."""

    __tablename__ = "builds"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)

    # The round's attacks, as a JSON list of schemas.AttackEntry dicts
    # (validated by Pydantic on the way in and out). JSON rather than a
    # child table: entries are always read/written as a whole list, and new
    # per-attack options (roadmap steps 10-12) need no schema migration.
    attacks = Column(JSON, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
