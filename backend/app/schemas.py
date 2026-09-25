"""Pydantic request/response models for the API."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class CalculateRequest(BaseModel):
    attack_bonus: int
    ac_list: List[int] = Field(..., min_length=1, max_length=30)
    num_dice: int = Field(..., ge=1, le=100)
    die_sides: int = Field(..., ge=2, le=1000)
    modifier: int = 0
    num_attacks: int = Field(1, ge=1, le=20)
    advantage: bool = False
    disadvantage: bool = False
    crit_range: int = Field(20, ge=2, le=20)
    power_attack: bool = False
    power_attack_bonus: int = 0
    power_attack_penalty: int = 0

    @field_validator("ac_list")
    @classmethod
    def ac_in_range(cls, v: List[int]) -> List[int]:
        for ac in v:
            if not (1 <= ac <= 30):
                raise ValueError("Each AC must be between 1 and 30.")
        return v


class ACResult(BaseModel):
    ac: int
    hit_chance: float
    crit_chance: float
    had: float
    total_had_per_round: float
    power_hit_chance: Optional[float] = None
    power_crit_chance: Optional[float] = None
    power_had: Optional[float] = None
    power_total_had_per_round: Optional[float] = None


class CalculateResponse(BaseModel):
    results: List[ACResult]


class BreakevenRequest(BaseModel):
    attack_bonus: int
    num_dice: int = Field(..., ge=1, le=100)
    die_sides: int = Field(..., ge=2, le=1000)
    modifier: int = 0
    power_attack_bonus: int
    power_attack_penalty: int
    advantage: bool = False
    disadvantage: bool = False
    crit_range: int = Field(20, ge=2, le=20)
    ac_min: int = Field(1, ge=1, le=30)
    ac_max: int = Field(30, ge=1, le=30)

    @model_validator(mode="after")
    def max_after_min(self) -> "BreakevenRequest":
        if self.ac_max < self.ac_min:
            raise ValueError("ac_max must be greater than or equal to ac_min.")
        return self


class BreakevenRow(BaseModel):
    ac: int
    normal_had: float
    power_had: float


class BreakevenResponse(BaseModel):
    rows: List[BreakevenRow]
    crossovers: List[int]


# ---------------------------------------------------------------------------
# Saved builds (step 2: persistence)
# ---------------------------------------------------------------------------

class BuildBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    attack_bonus: int
    num_dice: int = Field(..., ge=1, le=100)
    die_sides: int = Field(..., ge=2, le=1000)
    modifier: int = 0
    num_attacks: int = Field(1, ge=1, le=20)
    advantage: bool = False
    disadvantage: bool = False
    crit_range: int = Field(20, ge=2, le=20)
    power_attack: bool = False
    power_attack_bonus: int = 0
    power_attack_penalty: int = 0


class BuildCreate(BuildBase):
    """Everything required to save a new build."""
    pass


class BuildUpdate(BaseModel):
    """A partial update -- every field optional, only what's sent gets changed."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    attack_bonus: Optional[int] = None
    num_dice: Optional[int] = Field(None, ge=1, le=100)
    die_sides: Optional[int] = Field(None, ge=2, le=1000)
    modifier: Optional[int] = None
    num_attacks: Optional[int] = Field(None, ge=1, le=20)
    advantage: Optional[bool] = None
    disadvantage: Optional[bool] = None
    crit_range: Optional[int] = Field(None, ge=2, le=20)
    power_attack: Optional[bool] = None
    power_attack_bonus: Optional[int] = None
    power_attack_penalty: Optional[int] = None


class BuildRead(BuildBase):
    id: int
    created_at: datetime
    updated_at: datetime

    # Lets this model populate itself straight from a SQLAlchemy Build
    # object's attributes, not just from a dict.
    model_config = ConfigDict(from_attributes=True)


class BuildCalculateRequest(BaseModel):
    """AC list to run a saved build's stored attack profile against."""
    ac_list: List[int] = Field(..., min_length=1, max_length=30)

    @field_validator("ac_list")
    @classmethod
    def ac_in_range(cls, v: List[int]) -> List[int]:
        for ac in v:
            if not (1 <= ac <= 30):
                raise ValueError("Each AC must be between 1 and 30.")
        return v
