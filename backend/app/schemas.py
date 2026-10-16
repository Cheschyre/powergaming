"""Pydantic request/response models for the API."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

MAX_ATTACKS_PER_ROUND = 20


def _check_ac_list(v: list[int]) -> list[int]:
    for ac in v:
        if not (1 <= ac <= 30):
            raise ValueError("Each AC must be between 1 and 30.")
    return v


class AttackEntry(BaseModel):
    """One attack roll in a round, with everything that can differ between
    attacks -- including whether this particular attack uses power attack
    (GWM/Sharpshooter). A round is a list of these; repeat an entry for
    Extra Attack rather than using a count."""

    name: str = Field("Attack", min_length=1, max_length=50)
    attack_bonus: int
    num_dice: int = Field(..., ge=1, le=100)
    die_sides: int = Field(..., ge=2, le=1000)
    modifier: int = 0
    crit_range: int = Field(20, ge=2, le=20)
    advantage: bool = False
    disadvantage: bool = False
    power_attack: bool = False
    power_attack_bonus: int = 0
    power_attack_penalty: int = 0


class CalculateRequest(BaseModel):
    ac_list: list[int] = Field(..., min_length=1, max_length=30)
    attacks: list[AttackEntry] = Field(..., min_length=1, max_length=MAX_ATTACKS_PER_ROUND)

    _ac_in_range = field_validator("ac_list")(_check_ac_list)


class AttackResult(BaseModel):
    """One attack's numbers against one AC, with its own power-attack
    setting applied."""

    hit_chance: float
    crit_chance: float
    had: float


class ACResult(BaseModel):
    """A full round against one AC. `attacks` is in the same order as the
    request's attack list."""

    # Every field is always returned (total_had_without_power_attack is null,
    # not absent, when no attack uses power attack) -- mark them required in
    # the OpenAPI schema so generated frontend types match the real API.
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    ac: int
    attacks: list[AttackResult]
    # Expected damage for the whole round. Computed here rather than summed
    # by clients: once-per-turn effects (Sneak Attack, roadmap step 11)
    # make the round total more than a plain sum.
    total_had: float
    # The same round with every attack's power attack switched off -- for
    # comparing; null when no attack uses power attack.
    total_had_without_power_attack: float | None = None


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
    attacks: list[AttackEntry] = Field(..., min_length=1, max_length=MAX_ATTACKS_PER_ROUND)


class BuildCreate(BuildBase):
    """Everything required to save a new build."""

    pass


class BuildUpdate(BaseModel):
    """A partial update -- send only what changes. `attacks`, if sent,
    replaces the whole list."""

    name: str | None = Field(None, min_length=1, max_length=100)
    attacks: list[AttackEntry] | None = Field(None, min_length=1, max_length=MAX_ATTACKS_PER_ROUND)


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
    """AC list to run a saved build's stored attacks against."""

    ac_list: list[int] = Field(..., min_length=1, max_length=30)

    _ac_in_range = field_validator("ac_list")(_check_ac_list)
