"""
Database access functions ("CRUD" -- Create, Read, Update, Delete).

Kept separate from the route handlers in app/routers/ so the HTTP layer
doesn't know about SQLAlchemy queries, and so these are testable/reusable
on their own.
"""

from sqlalchemy.orm import Session

from app import models, schemas


def create_build(db: Session, build: schemas.BuildCreate) -> models.Build:
    db_build = models.Build(**build.model_dump(mode="json"))
    db.add(db_build)
    db.commit()
    db.refresh(db_build)
    return db_build


def get_build(db: Session, build_id: int) -> models.Build | None:
    return db.query(models.Build).filter(models.Build.id == build_id).first()


def list_builds(db: Session, skip: int = 0, limit: int = 100) -> list[models.Build]:
    return db.query(models.Build).order_by(models.Build.id).offset(skip).limit(limit).all()


def update_build(db: Session, db_build: models.Build, updates: schemas.BuildUpdate) -> models.Build:
    for field, value in updates.model_dump(mode="json", exclude_unset=True).items():
        setattr(db_build, field, value)
    db.add(db_build)
    db.commit()
    db.refresh(db_build)
    return db_build


def delete_build(db: Session, db_build: models.Build) -> None:
    db.delete(db_build)
    db.commit()
