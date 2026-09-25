"""SQLAlchemy ORM models."""

from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.sql import func

from app.db import Base


class Build(Base):
    """A saved attack profile -- the persisted version of what /api/calculate
    takes as a one-off request body."""

    __tablename__ = "builds"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)

    attack_bonus = Column(Integer, nullable=False)
    num_dice = Column(Integer, nullable=False)
    die_sides = Column(Integer, nullable=False)
    modifier = Column(Integer, nullable=False, default=0)
    num_attacks = Column(Integer, nullable=False, default=1)

    advantage = Column(Boolean, nullable=False, default=False)
    disadvantage = Column(Boolean, nullable=False, default=False)
    crit_range = Column(Integer, nullable=False, default=20)

    power_attack = Column(Boolean, nullable=False, default=False)
    power_attack_bonus = Column(Integer, nullable=False, default=0)
    power_attack_penalty = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
