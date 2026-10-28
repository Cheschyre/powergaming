"""
Character sheet -> attack entries (roadmap step 13, first slice).

Pure rules, 2014 edition: turns what a player enters (class, level, ability
scores, weapons) into the same AttackEntry list and once-per-turn damage
that /api/calculate takes, so the engine does all the probability math and
every engine feature (steps 9-12) applies to characters unchanged.

Covered: Fighter (Extra Attack, Champion crits, SRD fighting styles) and
Rogue (Sneak Attack), two-weapon fighting, magic +N weapons, and power
attack as a round toggle. Not yet: Action Surge, other classes, races.
"""

from math import ceil

from app.schemas import (
    AttackEntry,
    CharacterSheet,
    DerivedRound,
    OncePerTurn,
    RoundToggles,
    WeaponChoice,
    WeaponProfile,
)

POWER_ATTACK_BONUS = 10
POWER_ATTACK_PENALTY = -5


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


def weapon_ability_modifier(sheet: CharacterSheet, weapon: WeaponProfile) -> int:
    strength = ability_modifier(sheet.strength)
    dexterity = ability_modifier(sheet.dexterity)
    if weapon.finesse:
        return max(strength, dexterity)
    return dexterity if weapon.ranged else strength


def _weapon_name(choice: WeaponChoice, suffix: str = "") -> str:
    name = choice.profile.name
    if choice.magic_bonus:
        name = f"+{choice.magic_bonus} {name}"
    return f"{name}{suffix}"[:50]


def _is_fighter(sheet: CharacterSheet) -> bool:
    return sheet.character_class == "fighter"


def _attack(
    sheet: CharacterSheet,
    toggles: RoundToggles,
    choice: WeaponChoice,
    *,
    off_hand: bool,
) -> AttackEntry:
    weapon = choice.profile
    fighter = _is_fighter(sheet)
    style = sheet.fighting_style if fighter else "none"
    ability = weapon_ability_modifier(sheet, weapon)
    two_hands = not off_hand and sheet.two_handed_grip

    attack_bonus = ability + choice.magic_bonus + sheet.other_to_hit
    if choice.proficient:
        attack_bonus += proficiency_bonus(sheet.level)
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
        crit_range = champion_crit_range(sheet.level)

    power_attack = toggles.power_attack and (weapon.ranged or weapon.heavy)

    return AttackEntry(
        name=_weapon_name(choice, " (off-hand)" if off_hand else ""),
        attack_bonus=attack_bonus,
        num_dice=weapon.num_dice,
        die_sides=die_sides,
        modifier=modifier,
        crit_range=crit_range,
        advantage=toggles.advantage,
        disadvantage=toggles.disadvantage,
        power_attack=power_attack,
        power_attack_bonus=POWER_ATTACK_BONUS if power_attack else 0,
        power_attack_penalty=POWER_ATTACK_PENALTY if power_attack else 0,
        once_per_turn_eligible=weapon.finesse or weapon.ranged,
        reroll_at_or_below=reroll,
    )


def derive_round(sheet: CharacterSheet, toggles: RoundToggles) -> DerivedRound:
    """The attacks a character makes in one round with the Attack action
    (plus the bonus-action off-hand attack), and their Sneak Attack."""
    count = fighter_attacks(sheet.level) if _is_fighter(sheet) else 1
    main = _attack(sheet, toggles, sheet.main_hand, off_hand=False)
    attacks = [main.model_copy() for _ in range(count)]
    if sheet.off_hand is not None:
        attacks.append(_attack(sheet, toggles, sheet.off_hand, off_hand=True))

    once_per_turn = None
    sneak_attack = sheet.character_class == "rogue" and sheet.sneak_attack_can_trigger
    if sneak_attack and any(a.once_per_turn_eligible for a in attacks):
        once_per_turn = OncePerTurn(
            name="Sneak Attack", num_dice=sneak_attack_dice(sheet.level), die_sides=6
        )
    if once_per_turn is None:
        # Without Sneak Attack the eligible flags mean nothing -- clear them
        # so a saved snapshot doesn't carry stray ticks.
        attacks = [a.model_copy(update={"once_per_turn_eligible": False}) for a in attacks]

    return DerivedRound(attacks=attacks, once_per_turn=once_per_turn)
