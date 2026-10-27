"""Character sheet routes: the SRD weapons table, deriving or calculating
a character's round, and saved characters."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, schemas
from app.character import derive_round
from app.db import get_db
from app.service import compute_ac_results
from app.srd import SRD_WEAPONS

router = APIRouter(prefix="/api", tags=["characters"])


@router.get("/srd/weapons", response_model=list[schemas.SrdWeapon])
def list_srd_weapons():
    """The 2014 SRD weapons table (SRD 5.1, CC-BY-4.0 -- see app/srd.py)."""
    return list(SRD_WEAPONS.values())


def _calculate(
    sheet: schemas.CharacterSheet, toggles: schemas.RoundToggles, ac_list: list[int]
) -> schemas.CharacterCalculateResponse:
    derived = derive_round(sheet, toggles)
    results = compute_ac_results(derived.attacks, ac_list, derived.once_per_turn)
    return schemas.CharacterCalculateResponse(**derived.model_dump(), results=results)


@router.post("/characters/derive", response_model=schemas.DerivedRound)
def derive_character(req: schemas.CharacterDeriveRequest):
    """The attack entries (and Sneak Attack) a character makes in a round."""
    return derive_round(req.character, req.toggles)


@router.post("/characters/calculate", response_model=schemas.CharacterCalculateResponse)
def calculate_character(req: schemas.CharacterCalculateRequest):
    """Derive a character's round and run it against a list of ACs -- the
    same numbers /api/calculate gives for the derived attacks."""
    return _calculate(req.character, req.toggles, req.ac_list)


# --- Saved characters ---


def _get_or_404(db: Session, character_id: int):
    db_character = crud.get_character(db, character_id)
    if db_character is None:
        raise HTTPException(status_code=404, detail="Character not found")
    return db_character


@router.post(
    "/characters", response_model=schemas.CharacterRead, status_code=status.HTTP_201_CREATED
)
def create_character(sheet: schemas.CharacterSheet, db: Session = Depends(get_db)):
    return crud.character_read(crud.create_character(db, sheet))


@router.get("/characters", response_model=list[schemas.CharacterRead])
def list_characters(db: Session = Depends(get_db)):
    return [crud.character_read(c) for c in crud.list_characters(db)]


@router.get("/characters/{character_id}", response_model=schemas.CharacterRead)
def get_character(character_id: int, db: Session = Depends(get_db)):
    return crud.character_read(_get_or_404(db, character_id))


@router.put("/characters/{character_id}", response_model=schemas.CharacterRead)
def replace_character(
    character_id: int, sheet: schemas.CharacterSheet, db: Session = Depends(get_db)
):
    """Replace the whole sheet -- its rules span fields (e.g. off-hand vs.
    grip), so it's edited and validated as one unit rather than patched."""
    db_character = _get_or_404(db, character_id)
    return crud.character_read(crud.replace_character(db, db_character, sheet))


@router.delete("/characters/{character_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_character(character_id: int, db: Session = Depends(get_db)):
    crud.delete_character(db, _get_or_404(db, character_id))


@router.post(
    "/characters/{character_id}/calculate", response_model=schemas.CharacterCalculateResponse
)
def calculate_saved_character(
    character_id: int, req: schemas.CharacterRunRequest, db: Session = Depends(get_db)
):
    sheet = crud.character_read(_get_or_404(db, character_id))
    return _calculate(sheet, req.toggles, req.ac_list)


@router.post(
    "/characters/{character_id}/save-as-build",
    response_model=schemas.BuildRead,
    status_code=status.HTTP_201_CREATED,
)
def save_character_as_build(
    character_id: int, req: schemas.SaveAsBuildRequest, db: Session = Depends(get_db)
):
    """Save the character's derived round (with these toggles) as a build,
    to compare against other builds. A snapshot: later edits to the
    character don't change it."""
    sheet = crud.character_read(_get_or_404(db, character_id))
    derived = derive_round(sheet, req.toggles)
    name = req.name or f"{sheet.name} (level {sheet.level})"
    build = schemas.BuildCreate(
        name=name[:100], attacks=derived.attacks, once_per_turn=derived.once_per_turn
    )
    return crud.create_build(db, build)
