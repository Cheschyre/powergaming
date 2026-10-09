"""
Glue layer between the pure calculator math (app/calculator.py) and the API
response schemas (app/schemas.py). Pulled out so both /api/calculate and
the per-build calculate endpoint can share one implementation instead of
duplicating the same loop.
"""

from collections.abc import Sequence

from app.calculator import crit_chance, had, hit_chance
from app.schemas import ACResult, AttackEntry, AttackResult


def attack_result(attack: AttackEntry, ac: int, use_power_attack: bool) -> AttackResult:
    """One attack against one AC, with or without its power-attack trade."""
    bonus = attack.power_attack_bonus if use_power_attack else 0
    penalty = attack.power_attack_penalty if use_power_attack else 0
    return AttackResult(
        hit_chance=hit_chance(
            attack.attack_bonus, ac, penalty, attack.advantage, attack.disadvantage
        ),
        crit_chance=crit_chance(
            attack.attack_bonus,
            ac,
            penalty,
            attack.advantage,
            attack.disadvantage,
            attack.crit_range,
        ),
        had=had(
            attack.attack_bonus,
            ac,
            attack.num_dice,
            attack.die_sides,
            attack.modifier,
            bonus,
            penalty,
            attack.advantage,
            attack.disadvantage,
            attack.crit_range,
        ),
    )


def round_total(results: Sequence[AttackResult]) -> float:
    """Expected damage for the round. A plain sum today (expectation is
    additive across independent attacks); once-per-turn effects such as
    Sneak Attack (roadmap step 11) will extend this, which is why clients
    get the total from here instead of summing themselves."""
    return sum(r.had for r in results)


def compute_ac_results(attacks: Sequence[AttackEntry], ac_list: Sequence[int]) -> list[ACResult]:
    any_power_attack = any(a.power_attack for a in attacks)
    results = []
    for ac in ac_list:
        per_attack = [attack_result(a, ac, a.power_attack) for a in attacks]
        without_pa = None
        if any_power_attack:
            without_pa = round_total([attack_result(a, ac, False) for a in attacks])
        results.append(
            ACResult(
                ac=ac,
                attacks=per_attack,
                total_had=round_total(per_attack),
                total_had_without_power_attack=without_pa,
            )
        )
    return results
