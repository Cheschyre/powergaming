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
    # Can this attack carry the round's once-per-turn damage (e.g. a finesse
    # or ranged attack for Sneak Attack)? Ignored when the round has none.
    once_per_turn_eligible: bool = False


class OncePerTurn(BaseModel):
    """Extra damage added once per turn, to the first eligible attack that
    hits -- Sneak Attack, or any similar rider. Generic on purpose: the name
    is just a label, and which attacks qualify is set per attack."""

    name: str = Field("Extra damage", min_length=1, max_length=50)
    num_dice: int = Field(..., ge=1, le=100)
    die_sides: int = Field(..., ge=2, le=1000)
    modifier: int = 0


def _check_once_per_turn(attacks: list[AttackEntry], once_per_turn: OncePerTurn | None) -> None:
    if once_per_turn is not None and not any(a.once_per_turn_eligible for a in attacks):
        raise ValueError(
            f"Mark at least one attack as eligible for {once_per_turn.name}, "
            "or remove the once-per-turn damage."
        )


class CalculateRequest(BaseModel):
    ac_list: list[int] = Field(..., min_length=1, max_length=30)
    attacks: list[AttackEntry] = Field(..., min_length=1, max_length=MAX_ATTACKS_PER_ROUND)
    once_per_turn: OncePerTurn | None = None

    _ac_in_range = field_validator("ac_list")(_check_ac_list)

    @model_validator(mode="after")
    def once_per_turn_has_an_eligible_attack(self) -> "CalculateRequest":
        _check_once_per_turn(self.attacks, self.once_per_turn)
        return self


class AttackResult(BaseModel):
    """One attack's numbers against one AC, with its own power-attack
    setting applied."""

    hit_chance: float
    crit_chance: float
    had: float


class OncePerTurnResult(BaseModel):
    """The round's once-per-turn damage against one AC."""

    # Chance at least one eligible attack hits, i.e. the rider lands at all.
    chance: float
    # Expected rider damage for the round (crits double its dice).
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
    # Null when the round has no once-per-turn damage.
    once_per_turn: OncePerTurnResult | None = None
    # Expected damage for the whole round, once-per-turn damage included --
    # which is why it's computed here rather than summed by clients.
    total_had: float
    # The same round with every attack's power attack switched off (the
    # once-per-turn damage recomputed at the higher hit chances) -- for
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
    once_per_turn: OncePerTurn | None = None

    @model_validator(mode="after")
    def once_per_turn_has_an_eligible_attack(self) -> "BuildBase":
        _check_once_per_turn(self.attacks, self.once_per_turn)
        return self


class BuildCreate(BuildBase):
    """Everything required to save a new build."""

    pass


class BuildUpdate(BaseModel):
    """A partial update -- send only what changes. `attacks`, if sent,
    replaces the whole list; `once_per_turn: null` removes it. The merged
    build must still be valid (see BuildBase)."""

    name: str | None = Field(None, min_length=1, max_length=100)
    attacks: list[AttackEntry] | None = Field(None, min_length=1, max_length=MAX_ATTACKS_PER_ROUND)
    once_per_turn: OncePerTurn | None = None


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
