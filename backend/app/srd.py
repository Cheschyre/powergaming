"""
Rules data from the 2014 System Reference Document (SRD 5.1).

This work includes material taken from the System Reference Document 5.1
("SRD 5.1") by Wizards of the Coast LLC and available at
https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1
is licensed under the Creative Commons Attribution 4.0 International
License available at https://creativecommons.org/licenses/by/4.0/legalcode.

Only what the calculator needs is kept: damage dice and the properties
that change an attack's numbers. Weapons that don't roll damage dice (the
blowgun deals a flat 1, the net none) are left out.
"""

from app.schemas import SrdWeapon


def _weapon(
    key: str,
    name: str,
    category: str,
    dice: str,
    *properties: str,
    versatile: int | None = None,
) -> SrdWeapon:
    num_dice, die_sides = (int(n) for n in dice.split("d"))
    return SrdWeapon(
        key=key,
        name=name,
        category=category,
        num_dice=num_dice,
        die_sides=die_sides,
        versatile_die_sides=versatile,
        finesse="finesse" in properties,
        light="light" in properties,
        heavy="heavy" in properties,
        two_handed="two-handed" in properties,
        ranged="ranged" in properties,
    )


_WEAPONS = [
    # Simple melee
    _weapon("club", "Club", "simple", "1d4", "light"),
    _weapon("dagger", "Dagger", "simple", "1d4", "finesse", "light"),
    _weapon("greatclub", "Greatclub", "simple", "1d8", "two-handed"),
    _weapon("handaxe", "Handaxe", "simple", "1d6", "light"),
    _weapon("javelin", "Javelin", "simple", "1d6"),
    _weapon("light_hammer", "Light hammer", "simple", "1d4", "light"),
    _weapon("mace", "Mace", "simple", "1d6"),
    _weapon("quarterstaff", "Quarterstaff", "simple", "1d6", versatile=8),
    _weapon("sickle", "Sickle", "simple", "1d4", "light"),
    _weapon("spear", "Spear", "simple", "1d6", versatile=8),
    # Simple ranged
    _weapon("light_crossbow", "Light crossbow", "simple", "1d8", "ranged", "two-handed"),
    _weapon("dart", "Dart", "simple", "1d4", "ranged", "finesse"),
    _weapon("shortbow", "Shortbow", "simple", "1d6", "ranged", "two-handed"),
    _weapon("sling", "Sling", "simple", "1d4", "ranged"),
    # Martial melee
    _weapon("battleaxe", "Battleaxe", "martial", "1d8", versatile=10),
    _weapon("flail", "Flail", "martial", "1d8"),
    _weapon("glaive", "Glaive", "martial", "1d10", "heavy", "two-handed"),
    _weapon("greataxe", "Greataxe", "martial", "1d12", "heavy", "two-handed"),
    _weapon("greatsword", "Greatsword", "martial", "2d6", "heavy", "two-handed"),
    _weapon("halberd", "Halberd", "martial", "1d10", "heavy", "two-handed"),
    _weapon("lance", "Lance", "martial", "1d12"),
    _weapon("longsword", "Longsword", "martial", "1d8", versatile=10),
    _weapon("maul", "Maul", "martial", "2d6", "heavy", "two-handed"),
    _weapon("morningstar", "Morningstar", "martial", "1d8"),
    _weapon("pike", "Pike", "martial", "1d10", "heavy", "two-handed"),
    _weapon("rapier", "Rapier", "martial", "1d8", "finesse"),
    _weapon("scimitar", "Scimitar", "martial", "1d6", "finesse", "light"),
    _weapon("shortsword", "Shortsword", "martial", "1d6", "finesse", "light"),
    _weapon("trident", "Trident", "martial", "1d6", versatile=8),
    _weapon("war_pick", "War pick", "martial", "1d8"),
    _weapon("warhammer", "Warhammer", "martial", "1d8", versatile=10),
    _weapon("whip", "Whip", "martial", "1d4", "finesse"),
    # Martial ranged
    _weapon("hand_crossbow", "Hand crossbow", "martial", "1d6", "ranged", "light"),
    _weapon("heavy_crossbow", "Heavy crossbow", "martial", "1d10", "ranged", "heavy", "two-handed"),
    _weapon("longbow", "Longbow", "martial", "1d8", "ranged", "heavy", "two-handed"),
]

SRD_WEAPONS: dict[str, SrdWeapon] = {w.key: w for w in _WEAPONS}
