"""Routes for saving, listing, editing and calculating from stored builds."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, schemas
from app.db import get_db
from app.service import compute_ac_results

router = APIRouter(prefix="/api/builds", tags=["builds"])


@router.post("", response_model=schemas.BuildRead, status_code=status.HTTP_201_CREATED)
def create_build(build: schemas.BuildCreate, db: Session = Depends(get_db)):
    return crud.create_build(db, build)


@router.get("", response_model=List[schemas.BuildRead])
def list_builds(db: Session = Depends(get_db)):
    return crud.list_builds(db)


@router.get("/{build_id}", response_model=schemas.BuildRead)
def get_build(build_id: int, db: Session = Depends(get_db)):
    db_build = crud.get_build(db, build_id)
    if db_build is None:
        raise HTTPException(status_code=404, detail="Build not found")
    return db_build


@router.patch("/{build_id}", response_model=schemas.BuildRead)
def update_build(build_id: int, updates: schemas.BuildUpdate, db: Session = Depends(get_db)):
    db_build = crud.get_build(db, build_id)
    if db_build is None:
        raise HTTPException(status_code=404, detail="Build not found")
    return crud.update_build(db, db_build, updates)


@router.delete("/{build_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_build(build_id: int, db: Session = Depends(get_db)):
    db_build = crud.get_build(db, build_id)
    if db_build is None:
        raise HTTPException(status_code=404, detail="Build not found")
    crud.delete_build(db, db_build)


@router.post("/{build_id}/calculate", response_model=schemas.CalculateResponse)
def calculate_for_build(
    build_id: int, req: schemas.BuildCalculateRequest, db: Session = Depends(get_db)
):
    """Run a saved build's stored attack profile against a list of ACs --
    same math as /api/calculate, just pulling the attack profile from the
    database instead of the request body."""
    db_build = crud.get_build(db, build_id)
    if db_build is None:
        raise HTTPException(status_code=404, detail="Build not found")

    results = compute_ac_results(
        db_build.attack_bonus, req.ac_list, db_build.num_dice, db_build.die_sides,
        db_build.modifier, db_build.num_attacks, db_build.advantage, db_build.disadvantage,
        db_build.crit_range, db_build.power_attack, db_build.power_attack_bonus,
        db_build.power_attack_penalty,
    )
    return schemas.CalculateResponse(results=results)
