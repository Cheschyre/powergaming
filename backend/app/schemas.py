"""Pydantic request/response models for the API."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class CalculateRequest(BaseModel):
    attack_bonus: int
    ac_list: list[int] = Field(..., min_length=1, max_length=30)
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
    def ac_in_range(cls, v: list[int]) -> list[int]:
        for ac in v:
            if not (1 <= ac <= 30):
                raise ValueError("Each AC must be between 1 and 30.")
        return v


class ACResult(BaseModel):
    # Responses always include every field (power_* are null, not absent,
    # when power attack is off) -- mark them required in the OpenAPI schema
    # so generated frontend types match what the API actually returns.
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    ac: int
    hit_chance: float
    crit_chance: float
    had: float
    total_had_per_round: float
    power_hit_chance: float | None = None
    power_crit_chance: float | None = None
    power_had: float | None = None
    power_total_had_per_round: float | None = None


class CalculateResponse(BaseModel):
    results: list[ACResult]


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
    rows: list[BreakevenRow]
    crossovers: list[int]


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

    name: str | None = Field(None, min_length=1, max_length=100)
    attack_bonus: int | None = None
    num_dice: int | None = Field(None, ge=1, le=100)
    die_sides: int | None = Field(None, ge=2, le=1000)
    modifier: int | None = None
    num_attacks: int | None = Field(None, ge=1, le=20)
    advantage: bool | None = None
    disadvantage: bool | None = None
    crit_range: int | None = Field(None, ge=2, le=20)
    power_attack: bool | None = None
    power_attack_bonus: int | None = None
    power_attack_penalty: int | None = None


class BuildRead(BuildBase):
    id: int
    created_at: datetime
    updated_at: datetime

    # from_attributes: populate straight from a SQLAlchemy Build object.
    # json_schema_serialization_defaults_required: every field is always
    # returned, so the OpenAPI schema (and generated frontend types) should
    # say so, not mark defaulted fields optional.
    model_config = ConfigDict(
        from_attributes=True, json_schema_serialization_defaults_required=True
    )


class BuildCalculateRequest(BaseModel):
    """AC list to run a saved build's stored attack profile against."""

    ac_list: list[int] = Field(..., min_length=1, max_length=30)

    @field_validator("ac_list")
    @classmethod
    def ac_in_range(cls, v: list[int]) -> list[int]:
        for ac in v:
            if not (1 <= ac <= 30):
                raise ValueError("Each AC must be between 1 and 30.")
        return v
