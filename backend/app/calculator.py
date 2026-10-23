"""
D&D 5e power-gaming math.

This is the API's calculation core, ported from the original CLI tool.
It's pure functions with no I/O, deliberately -- it's called by the API
layer (app/main.py) but doesn't know anything about HTTP, so it can be
unit tested and reused on its own.
"""


def average_damage(num_dice: int, die_sides: int, modifier: int = 0) -> float:
    """Average damage before accuracy is factored in."""
    die_average = (die_sides + 1) / 2
    return (die_average * num_dice) + modifier


def get_roll_distribution(advantage: bool = False, disadvantage: bool = False) -> dict[int, float]:
    """
    Probability of each d20 face (1-20) coming up as the roll used for an
    attack, accounting for advantage/disadvantage. Advantage and
    disadvantage cancel each other out per 5e RAW.
    """
    if advantage and disadvantage:
        advantage = disadvantage = False

    if not advantage and not disadvantage:
        return {face: 1 / 20 for face in range(1, 21)}

    dist = {}
    for face in range(1, 21):
        if advantage:
            # P(max(d1, d2) == face)
            dist[face] = (2 * face - 1) / 400
        else:
            # P(min(d1, d2) == face)
            dist[face] = (2 * (21 - face) - 1) / 400
    return dist


def hit_chance(
    attack_bonus: int,
    target_ac: int,
    power_attack_penalty: int = 0,
    advantage: bool = False,
    disadvantage: bool = False,
) -> float:
    """
    Chance to hit. 5e RAW: natural 1 always misses, natural 20 always hits.
    """
    effective_bonus = attack_bonus + power_attack_penalty
    dist = get_roll_distribution(advantage, disadvantage)

    total = 0.0
    for face, prob in dist.items():
        if face == 1:
            continue  # auto miss
        if face == 20:
            total += prob  # auto hit
        elif face + effective_bonus >= target_ac:
            total += prob
    return total


def crit_chance(
    attack_bonus: int,
    target_ac: int,
    power_attack_penalty: int = 0,
    advantage: bool = False,
    disadvantage: bool = False,
    crit_range: int = 20,
) -> float:
    """
    Chance of landing a critical hit. A roll still has to hit (or be a
    natural 20, which always hits) to count as a crit -- an expanded crit
    range (e.g. 19-20 for Champion Fighters) doesn't bypass the AC check
    the way a natural 20 does.
    """
    effective_bonus = attack_bonus + power_attack_penalty
    dist = get_roll_distribution(advantage, disadvantage)

    total = 0.0
    for face, prob in dist.items():
        if face < crit_range or face == 1:
            continue
        # natural 20 always hits
        if face == 20 or face + effective_bonus >= target_ac:
            total += prob
    return total


def had(
    attack_bonus: int,
    target_ac: int,
    num_dice: int,
    die_sides: int,
    modifier: int = 0,
    power_attack_bonus: int = 0,
    power_attack_penalty: int = 0,
    advantage: bool = False,
    disadvantage: bool = False,
    crit_range: int = 20,
) -> float:
    """
    Hit-adjusted damage (HAD): expected damage per attack, weighted by hit
    chance and crit chance. Per RAW, a crit doubles dice only -- flat
    modifiers (including power attack bonus damage) are not doubled.
    """
    total_hit = hit_chance(attack_bonus, target_ac, power_attack_penalty, advantage, disadvantage)
    crit_p = crit_chance(
        attack_bonus, target_ac, power_attack_penalty, advantage, disadvantage, crit_range
    )
    normal_p = total_hit - crit_p

    normal_dmg = average_damage(num_dice, die_sides, modifier + power_attack_bonus)
    crit_dmg = average_damage(num_dice * 2, die_sides, modifier + power_attack_bonus)

    return normal_p * normal_dmg + crit_p * crit_dmg


def once_per_turn_damage(
    chances: list[tuple[float, float]], num_dice: int, die_sides: int, modifier: int = 0
) -> tuple[float, float]:
    """
    Once-per-turn extra damage (Sneak Attack, smite-style riders): added to
    the first eligible attack that hits, never more than once a turn.

    `chances` is (hit chance, crit chance) for each eligible attack, in the
    order they're made. Attack i carries the rider only if every eligible
    attack before it missed; if that hit is a crit, the rider's dice are
    doubled too (its flat modifier isn't, as with weapon damage).

    Returns (chance the rider lands at all, expected rider damage). Per-
    attack hits are independent, so this is exact -- not an approximation.
    """
    normal_dmg = average_damage(num_dice, die_sides, modifier)
    crit_dmg = average_damage(num_dice * 2, die_sides, modifier)

    all_missed_so_far = 1.0
    expected = 0.0
    for hit_p, crit_p in chances:
        expected += all_missed_so_far * ((hit_p - crit_p) * normal_dmg + crit_p * crit_dmg)
        all_missed_so_far *= 1 - hit_p
    return 1 - all_missed_so_far, expected


def find_power_attack_breakeven(
    attack_bonus: int,
    num_dice: int,
    die_sides: int,
    modifier: int,
    power_attack_bonus: int,
    power_attack_penalty: int,
    advantage: bool = False,
    disadvantage: bool = False,
    crit_range: int = 20,
    ac_min: int = 1,
    ac_max: int = 30,
):
    """
    Scan an AC range and compare a normal attack against a GWM/Sharpshooter
    -style power attack at each AC. Returns the per-AC results plus the
    AC(s) where the better option switches (the breakeven points).
    """
    results = []
    for ac in range(ac_min, ac_max + 1):
        normal = had(
            attack_bonus,
            ac,
            num_dice,
            die_sides,
            modifier,
            0,
            0,
            advantage,
            disadvantage,
            crit_range,
        )
        power = had(
            attack_bonus,
            ac,
            num_dice,
            die_sides,
            modifier,
            power_attack_bonus,
            power_attack_penalty,
            advantage,
            disadvantage,
            crit_range,
        )
        results.append((ac, normal, power))

    crossovers = []
    for i in range(1, len(results)):
        prev_ac, prev_normal, prev_power = results[i - 1]
        ac, normal, power = results[i]
        prev_diff = prev_power - prev_normal
        diff = power - normal
        if (prev_diff > 0) != (diff > 0) or diff == 0 and prev_diff != 0:
            crossovers.append(ac)

    return results, crossovers
