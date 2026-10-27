"""Character sheet routes: derive a character's round, or calculate it."""

from fastapi import APIRouter

from app import schemas
from app.character import derive_round
from app.service import compute_ac_results
from app.srd import SRD_WEAPONS

router = APIRouter(prefix="/api", tags=["characters"])


@router.get("/srd/weapons", response_model=list[schemas.SrdWeapon])
def list_srd_weapons():
    """The 2014 SRD weapons table (SRD 5.1, CC-BY-4.0 -- see app/srd.py)."""
    return list(SRD_WEAPONS.values())


@router.post("/characters/derive", response_model=schemas.DerivedRound)
def derive_character(req: schemas.CharacterDeriveRequest):
    """The attack entries (and Sneak Attack) a character makes in a round."""
    return derive_round(req.character, req.toggles)


@router.post("/characters/calculate", response_model=schemas.CharacterCalculateResponse)
def calculate_character(req: schemas.CharacterCalculateRequest):
    """Derive a character's round and run it against a list of ACs -- the
    same numbers /api/calculate gives for the derived attacks."""
    derived = derive_round(req.character, req.toggles)
    results = compute_ac_results(derived.attacks, req.ac_list, derived.once_per_turn)
    return schemas.CharacterCalculateResponse(**derived.model_dump(), results=results)
