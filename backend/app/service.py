"""
Glue layer between the pure calculator math (app/calculator.py) and the API
response schemas (app/schemas.py). Pulled out so both /api/calculate and
the per-build calculate endpoint can share one implementation instead of
duplicating the same loop.
"""

from collections.abc import Sequence

from app.calculator import crit_chance, had, hit_chance, once_per_turn_damage
from app.schemas import ACResult, AttackEntry, AttackResult, OncePerTurn, OncePerTurnResult


def attack_result(attack: AttackEntry, ac: int, use_power_attack: bool) -> AttackResult:
    """One attack against one AC, with or without its power-attack trade."""
    bonus = attack.power_attack_bonus if use_power_attack else 0
    penalty = attack.power_attack_penalty if use_power_attack else 0
    return AttackResult(
        hit_chance=hit_chance(
            attack.attack_bonus,
            ac,
            penalty,
            attack.advantage,
            attack.disadvantage,
            super_advantage=attack.super_advantage,
        ),
        crit_chance=crit_chance(
            attack.attack_bonus,
            ac,
            penalty,
            attack.advantage,
            attack.disadvantage,
            attack.crit_range,
            super_advantage=attack.super_advantage,
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
            **attack.engine_kwargs(),
        ),
    )


def once_per_turn_result(
    attacks: Sequence[AttackEntry], results: Sequence[AttackResult], once_per_turn: OncePerTurn
) -> OncePerTurnResult:
    """The rider against one AC, given each attack's result there (so it
    uses the same power-attack setting as the attacks themselves)."""
    chances = [
        (r.hit_chance, r.crit_chance)
        for a, r in zip(attacks, results, strict=True)
        if a.once_per_turn_eligible
    ]
    chance, expected = once_per_turn_damage(
        chances, once_per_turn.num_dice, once_per_turn.die_sides, once_per_turn.modifier
    )
    return OncePerTurnResult(chance=chance, had=expected)


def round_total(
    results: Sequence[AttackResult], once_per_turn: OncePerTurnResult | None = None
) -> float:
    """Expected damage for the round: the attacks' sum (expectation is
    additive across independent attacks) plus the once-per-turn damage,
    which isn't per attack -- why clients get the total from here instead
    of summing themselves."""
    total = sum(r.had for r in results)
    if once_per_turn is not None:
        total += once_per_turn.had
    return total


def compute_ac_results(
    attacks: Sequence[AttackEntry],
    ac_list: Sequence[int],
    once_per_turn: OncePerTurn | None = None,
) -> list[ACResult]:
    any_power_attack = any(a.power_attack for a in attacks)

    def rider(results: Sequence[AttackResult]) -> OncePerTurnResult | None:
        if once_per_turn is None:
            return None
        return once_per_turn_result(attacks, results, once_per_turn)

    results = []
    for ac in ac_list:
        per_attack = [attack_result(a, ac, a.power_attack) for a in attacks]
        extra = rider(per_attack)
        without_pa = None
        if any_power_attack:
            no_pa = [attack_result(a, ac, False) for a in attacks]
            without_pa = round_total(no_pa, rider(no_pa))
        results.append(
            ACResult(
                ac=ac,
                attacks=per_attack,
                once_per_turn=extra,
                total_had=round_total(per_attack, extra),
                total_had_without_power_attack=without_pa,
            )
        )
    return results
