"""Pydantic request/response models for the API."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

MAX_ATTACKS_PER_ROUND = 20


class AttackOptions(BaseModel):
    """Optional engine features shared by round attacks and the breakeven
    finder, named for what they do rather than the feat that grants them."""

    # Advantage rolls three d20s and keeps the best (Elven Accuracy). Only
    # counts when the attack has advantage (and not also disadvantage).
    super_advantage: bool = False
    # More weapon dice on a crit, on top of the doubled ones (Savage
    # Attacks, Brutal Critical, Piercer).
    extra_crit_dice: int = Field(0, ge=0, le=10)
    # Reroll a weapon damage die showing this or lower, once, keeping the
    # new roll (2014 Great Weapon Fighting: 2). 0 = off.
    reroll_at_or_below: int = Field(0, ge=0, le=999)

    @model_validator(mode="after")
    def reroll_below_die_size(self):
        die_sides = getattr(self, "die_sides", None)
        if die_sides is not None and self.reroll_at_or_below >= die_sides:
            raise ValueError(
                f"Reroll threshold must be below the die size (d{die_sides}): "
                "rerolling every result changes nothing."
            )
        return self

    def engine_kwargs(self) -> dict:
        return {
            "super_advantage": self.super_advantage,
            "extra_crit_dice": self.extra_crit_dice,
            "reroll_at_or_below": self.reroll_at_or_below,
        }


def _check_ac_list(v: list[int]) -> list[int]:
    for ac in v:
        if not (1 <= ac <= 30):
            raise ValueError("Each AC must be between 1 and 30.")
    return v


class AttackEntry(AttackOptions):
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


class BreakevenRequest(AttackOptions):
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


# ---------------------------------------------------------------------------
# Character sheet (roadmap step 13, first slice: 2014 rules, Fighter/Rogue)
# ---------------------------------------------------------------------------
#
# A character is entered as ability scores, level and weapons; the server
# derives the round's attack entries from it (app/character.py) and runs
# them through the same engine as everything else.

CharacterClass = Literal["fighter", "rogue"]
FightingStyle = Literal[
    "none", "archery", "dueling", "great_weapon_fighting", "two_weapon_fighting"
]
Subclass = Literal["none", "champion"]


class WeaponProfile(BaseModel):
    """A weapon's damage and properties -- an SRD weapon, or a custom one."""

    name: str = Field(..., min_length=1, max_length=50)
    num_dice: int = Field(..., ge=1, le=10)
    die_sides: int = Field(..., ge=2, le=20)
    # Die size when wielded in two hands (versatile weapons only).
    versatile_die_sides: int | None = Field(None, ge=2, le=20)
    finesse: bool = False
    light: bool = False
    heavy: bool = False
    two_handed: bool = False
    # A ranged weapon (bows, crossbows, darts, slings). Thrown melee
    # weapons count as melee in this slice.
    ranged: bool = False


class SrdWeapon(WeaponProfile):
    """A weapon from the 2014 SRD weapons table (see app/srd.py)."""

    key: str
    category: Literal["simple", "martial"]

    # Response-only, so every field is always returned. Not on
    # WeaponProfile: that's also a request body, and the setting would
    # split its generated types into separate Input/Output versions.
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)


class WeaponChoice(BaseModel):
    """A wielded weapon: either an SRD weapon by key or a custom profile."""

    srd_weapon: str | None = None
    custom: WeaponProfile | None = None
    # +N magic weapon: added to attack and damage rolls.
    magic_bonus: int = Field(0, ge=0, le=3)
    proficient: bool = True

    @model_validator(mode="after")
    def exactly_one_weapon(self) -> "WeaponChoice":
        from app.srd import SRD_WEAPONS  # app.srd imports this module

        if (self.srd_weapon is None) == (self.custom is None):
            raise ValueError("Choose an SRD weapon or enter a custom one (not both).")
        if self.srd_weapon is not None and self.srd_weapon not in SRD_WEAPONS:
            raise ValueError(f"Unknown SRD weapon: {self.srd_weapon!r}.")
        return self

    @property
    def profile(self) -> WeaponProfile:
        from app.srd import SRD_WEAPONS

        if self.custom is not None:
            return self.custom
        return SRD_WEAPONS[self.srd_weapon]


class CharacterSheet(BaseModel):
    """What the player enters. Everything else (proficiency, attacks per
    round, Sneak Attack dice, crit range) is derived from the level."""

    name: str = Field(..., min_length=1, max_length=100)
    character_class: CharacterClass
    level: int = Field(..., ge=1, le=20)
    strength: int = Field(..., ge=1, le=30)
    dexterity: int = Field(..., ge=1, le=30)
    main_hand: WeaponChoice
    off_hand: WeaponChoice | None = None
    # Wield a versatile main-hand weapon in two hands (its bigger die).
    two_handed_grip: bool = False
    # Fighter only.
    fighting_style: FightingStyle = "none"
    subclass: Subclass = "none"
    # Rogue only: stands in for "advantage, or an ally next to the target".
    sneak_attack_can_trigger: bool = True
    # Catch-alls for anything not modeled yet (applied to every attack).
    other_to_hit: int = Field(0, ge=-20, le=20)
    other_damage: int = Field(0, ge=-20, le=20)

    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    @model_validator(mode="after")
    def rules_fit_together(self) -> "CharacterSheet":
        main = self.main_hand.profile
        if self.character_class != "fighter":
            if self.fighting_style != "none":
                raise ValueError("Only Fighters choose a fighting style in this version.")
            if self.subclass != "none":
                raise ValueError("Only Fighters have a subclass option in this version.")
        if self.two_handed_grip:
            if main.versatile_die_sides is None:
                raise ValueError(f"{main.name} isn't versatile -- it can't change grip.")
            if self.off_hand is not None:
                raise ValueError("A two-handed grip leaves no hand for an off-hand weapon.")
        if self.off_hand is not None:
            off = self.off_hand.profile
            if main.two_handed:
                raise ValueError(f"{main.name} needs both hands -- drop the off-hand weapon.")
            # 2014 two-weapon fighting: both weapons light melee weapons.
            for weapon in (main, off):
                if not weapon.light or weapon.ranged:
                    raise ValueError(
                        "Two-weapon fighting needs a light melee weapon in each hand "
                        f"({weapon.name} isn't one)."
                    )
        return self


class RoundToggles(BaseModel):
    """Situational choices for one round -- set when calculating, not
    stored on the character."""

    advantage: bool = False
    disadvantage: bool = False
    # -5 to hit / +10 damage, on heavy melee or ranged weapon attacks only.
    power_attack: bool = False


class CharacterDeriveRequest(BaseModel):
    character: CharacterSheet
    toggles: RoundToggles = RoundToggles()


class DerivedRound(BaseModel):
    """The round a character makes: attack entries plus Sneak Attack, in
    exactly the shape /api/calculate and builds take."""

    attacks: list[AttackEntry]
    once_per_turn: OncePerTurn | None

    model_config = ConfigDict(json_schema_serialization_defaults_required=True)


class CharacterCalculateRequest(CharacterDeriveRequest):
    ac_list: list[int] = Field(..., min_length=1, max_length=30)

    _ac_in_range = field_validator("ac_list")(_check_ac_list)


class CharacterCalculateResponse(DerivedRound):
    results: list[ACResult]


class CharacterRead(CharacterSheet):
    """A saved character: the sheet plus its id and timestamps."""

    id: int
    created_at: datetime
    updated_at: datetime


class CharacterRunRequest(BaseModel):
    """Run a saved character: target ACs plus this round's toggles."""

    ac_list: list[int] = Field(..., min_length=1, max_length=30)
    toggles: RoundToggles = RoundToggles()

    _ac_in_range = field_validator("ac_list")(_check_ac_list)


class SaveAsBuildRequest(BaseModel):
    """Snapshot a character's derived round as a build. The build doesn't
    follow later changes to the character."""

    name: str | None = Field(None, min_length=1, max_length=100)
    toggles: RoundToggles = RoundToggles()
