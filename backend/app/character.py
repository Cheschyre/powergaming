"""
Character sheet -> attack entries (roadmap step 13 and v0.7).

Pure rules, 2014 edition: turns what a player enters (class, level, ability
scores and their improvements, weapons) into the same AttackEntry list and
once-per-turn damage that /api/calculate takes, so the engine does all the
probability math and every engine feature (steps 9-12) applies to
characters unchanged.

Everything is derived *at a level*: the character's own level for a normal
run, or each of 1-20 for the level view. Covered: Fighter (Extra Attack,
Champion crits, SRD fighting styles) and Rogue (Sneak Attack), ability score
improvements and the feats the engine models (Elven Accuracy, a power
attack feat), two-weapon fighting, magic +N weapons, and power attack as a
round toggle. Not yet: Action Surge, other classes, races.
"""

from dataclasses import dataclass
from math import ceil

from app.schemas import (
    AbilityScores,
    AttackEntry,
    CharacterSheet,
    DerivedRound,
    LevelRow,
    OncePerTurn,
    RoundToggles,
    WeaponChoice,
    WeaponProfile,
)
from app.service import compute_ac_results

POWER_ATTACK_BONUS = 10
POWER_ATTACK_PENALTY = -5
# An Ability Score Improvement can't raise a score above this.
ASI_SCORE_CAP = 20

# What each ASI choice adds: (STR, DEX).
_SCORE_INCREASES = {
    "strength_2": (2, 0),
    "dexterity_2": (0, 2),
    "strength_dexterity": (1, 1),
    "elven_accuracy": (0, 1),
    "power_attack_feat": (0, 0),
    "other_feat": (0, 0),
}

_CHOICE_NOTES = {
    "strength_2": "+2 STR",
    "dexterity_2": "+2 DEX",
    "strength_dexterity": "+1 STR, +1 DEX",
    "elven_accuracy": "Elven Accuracy (+1 DEX)",
    "power_attack_feat": "Power attack feat",
    "other_feat": "Feat",
}


def proficiency_bonus(level: int) -> int:
    """+2 at levels 1-4, +3 at 5-8, ... +6 at 17-20."""
    return 2 + (level - 1) // 4


def ability_modifier(score: int) -> int:
    return (score - 10) // 2


def fighter_attacks(level: int) -> int:
    """Extra Attack: 2 attacks at 5, 3 at 11, 4 at 20."""
    return 1 + (level >= 5) + (level >= 11) + (level >= 20)


def champion_crit_range(level: int) -> int:
    """Improved Critical (19-20) at 3, Superior Critical (18-20) at 15."""
    if level >= 15:
        return 18
    if level >= 3:
        return 19
    return 20


def sneak_attack_dice(level: int) -> int:
    """1d6 at level 1, one more every odd level: ceil(level / 2)."""
    return ceil(level / 2)


def _raise(score: int, amount: int) -> int:
    """An ASI adds up to the cap; a score already above it (magic items)
    stays where it is."""
    if amount == 0 or score >= ASI_SCORE_CAP:
        return score
    return min(ASI_SCORE_CAP, score + amount)


@dataclass(frozen=True)
class _AtLevel:
    """Everything about the character that depends on the level."""

    level: int
    strength: int
    dexterity: int
    elven_accuracy: bool
    # None: no power attack feat recorded, so the toggle applies at every
    # level (how characters worked before v0.7).
    has_power_attack_feat: bool | None


def _at_level(sheet: CharacterSheet, level: int) -> _AtLevel:
    strength, dexterity = sheet.strength, sheet.dexterity
    elven_accuracy = False
    feat_levels = [i.level for i in sheet.ability_increases if i.choice == "power_attack_feat"]
    for increase in sorted(sheet.ability_increases, key=lambda i: i.level):
        if increase.level > level:
            break
        str_inc, dex_inc = _SCORE_INCREASES[increase.choice]
        strength, dexterity = _raise(strength, str_inc), _raise(dexterity, dex_inc)
        elven_accuracy = elven_accuracy or increase.choice == "elven_accuracy"
    return _AtLevel(
        level=level,
        strength=strength,
        dexterity=dexterity,
        elven_accuracy=elven_accuracy,
        has_power_attack_feat=(min(feat_levels) <= level) if feat_levels else None,
    )


def current_scores(sheet: CharacterSheet) -> AbilityScores:
    at = _at_level(sheet, sheet.level)
    return AbilityScores(strength=at.strength, dexterity=at.dexterity)


def _weapon_ability(at: _AtLevel, weapon: WeaponProfile) -> tuple[str, int]:
    """The ability an attack uses, and its modifier. A finesse weapon uses
    the better of STR and DEX -- DEX on a tie, since that's the choice
    Elven Accuracy rewards."""
    strength = ability_modifier(at.strength)
    dexterity = ability_modifier(at.dexterity)
    if weapon.ranged or (weapon.finesse and dexterity >= strength):
        return "dexterity", dexterity
    return "strength", strength


def _weapon_name(choice: WeaponChoice, suffix: str = "") -> str:
    name = choice.profile.name
    if choice.magic_bonus:
        name = f"+{choice.magic_bonus} {name}"
    return f"{name}{suffix}"[:50]


def _is_fighter(sheet: CharacterSheet) -> bool:
    return sheet.character_class == "fighter"


def _attack(
    sheet: CharacterSheet,
    at: _AtLevel,
    toggles: RoundToggles,
    choice: WeaponChoice,
    *,
    off_hand: bool,
) -> AttackEntry:
    weapon = choice.profile
    fighter = _is_fighter(sheet)
    style = sheet.fighting_style if fighter else "none"
    ability_name, ability = _weapon_ability(at, weapon)
    two_hands = not off_hand and sheet.two_handed_grip

    attack_bonus = ability + choice.magic_bonus + sheet.other_to_hit
    if choice.proficient:
        attack_bonus += proficiency_bonus(at.level)
    if style == "archery" and weapon.ranged:
        attack_bonus += 2

    die_sides = weapon.versatile_die_sides if two_hands else weapon.die_sides

    # The off-hand attack adds the ability modifier to damage only if it's
    # negative, unless the Fighter has the Two-Weapon Fighting style.
    drops_ability = off_hand and ability > 0 and style != "two_weapon_fighting"
    modifier = (0 if drops_ability else ability) + choice.magic_bonus + sheet.other_damage
    # Dueling: a melee weapon in one hand and no other weapon.
    one_handed_melee = not (weapon.ranged or weapon.two_handed or two_hands)
    if style == "dueling" and one_handed_melee and sheet.off_hand is None:
        modifier += 2

    # Great Weapon Fighting: reroll 1s and 2s with a melee weapon held in
    # two hands (two-handed, or versatile in two hands).
    gwf = style == "great_weapon_fighting" and not weapon.ranged
    reroll = 2 if gwf and (weapon.two_handed or two_hands) else 0

    crit_range = 20
    if fighter and sheet.subclass == "champion":
        crit_range = champion_crit_range(at.level)

    # Power attack needs the feat once one is recorded on the sheet, and
    # only works with heavy melee or ranged weapons.
    has_feat = at.has_power_attack_feat is not False
    power_attack = toggles.power_attack and has_feat and (weapon.ranged or weapon.heavy)

    return AttackEntry(
        name=_weapon_name(choice, " (off-hand)" if off_hand else ""),
        attack_bonus=attack_bonus,
        num_dice=weapon.num_dice,
        die_sides=die_sides,
        modifier=modifier,
        crit_range=crit_range,
        advantage=toggles.advantage,
        disadvantage=toggles.disadvantage,
        # Elven Accuracy: attacks using DEX (never STR) roll three dice
        # when they have advantage -- the engine checks the advantage.
        super_advantage=at.elven_accuracy and ability_name == "dexterity",
        power_attack=power_attack,
        power_attack_bonus=POWER_ATTACK_BONUS if power_attack else 0,
        power_attack_penalty=POWER_ATTACK_PENALTY if power_attack else 0,
        once_per_turn_eligible=weapon.finesse or weapon.ranged,
        reroll_at_or_below=reroll,
    )


def _derive(sheet: CharacterSheet, toggles: RoundToggles, at: _AtLevel) -> DerivedRound:
    count = fighter_attacks(at.level) if _is_fighter(sheet) else 1
    main = _attack(sheet, at, toggles, sheet.main_hand, off_hand=False)
    attacks = [main.model_copy() for _ in range(count)]
    if sheet.off_hand is not None:
        attacks.append(_attack(sheet, at, toggles, sheet.off_hand, off_hand=True))

    once_per_turn = None
    sneak_attack = sheet.character_class == "rogue" and sheet.sneak_attack_can_trigger
    if sneak_attack and any(a.once_per_turn_eligible for a in attacks):
        once_per_turn = OncePerTurn(
            name="Sneak Attack", num_dice=sneak_attack_dice(at.level), die_sides=6
        )
    if once_per_turn is None:
        # Without Sneak Attack the eligible flags mean nothing -- clear them
        # so a saved snapshot doesn't carry stray ticks.
        attacks = [a.model_copy(update={"once_per_turn_eligible": False}) for a in attacks]

    return DerivedRound(attacks=attacks, once_per_turn=once_per_turn)


def derive_round(
    sheet: CharacterSheet, toggles: RoundToggles, level: int | None = None
) -> DerivedRound:
    """The attacks a character makes in one round with the Attack action
    (plus the bonus-action off-hand attack), and their Sneak Attack --
    at its own level, or at `level` for the level view."""
    return _derive(sheet, toggles, _at_level(sheet, sheet.level if level is None else level))


def level_notes(sheet: CharacterSheet, level: int) -> list[str]:
    """What changes at this level, for the level view's rows."""
    notes = []
    if level > 1 and proficiency_bonus(level) != proficiency_bonus(level - 1):
        notes.append(f"Proficiency +{proficiency_bonus(level)}")
    if _is_fighter(sheet):
        if fighter_attacks(level) != fighter_attacks(level - 1) and level > 1:
            count = fighter_attacks(level)
            notes.append("Extra Attack" if count == 2 else f"Extra Attack ({count} attacks)")
        if sheet.subclass == "champion":
            if level == 3:
                notes.append("Improved Critical (19-20)")
            elif level == 15:
                notes.append("Superior Critical (18-20)")
    elif level > 1 and sneak_attack_dice(level) != sneak_attack_dice(level - 1):
        notes.append(f"Sneak Attack {sneak_attack_dice(level)}d6")
    for increase in sheet.ability_increases:
        if increase.level == level:
            notes.append(_CHOICE_NOTES[increase.choice])
    return notes


def level_rows(sheet: CharacterSheet, toggles: RoundToggles, ac_list: list[int]) -> list[LevelRow]:
    """The character rebuilt at every level 1-20 and run against ac_list --
    each row matches a normal run of the character at that level."""
    rows = []
    for level in range(1, 21):
        at = _at_level(sheet, level)
        derived = _derive(sheet, toggles, at)
        results = compute_ac_results(derived.attacks, ac_list, derived.once_per_turn)
        rows.append(
            LevelRow(
                **derived.model_dump(),
                results=results,
                level=level,
                strength=at.strength,
                dexterity=at.dexterity,
                notes=level_notes(sheet, level),
            )
        )
    return rows
