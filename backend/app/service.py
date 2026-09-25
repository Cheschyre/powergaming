"""
Glue layer between the pure calculator math (app/calculator.py) and the API
response schemas (app/schemas.py). Pulled out so both /api/calculate and
the per-build calculate endpoint can share one implementation instead of
duplicating the same loop.
"""

from typing import List

from app.calculator import crit_chance, had, hit_chance
from app.schemas import ACResult


def compute_ac_results(
    attack_bonus: int,
    ac_list: List[int],
    num_dice: int,
    die_sides: int,
    modifier: int,
    num_attacks: int,
    advantage: bool,
    disadvantage: bool,
    crit_range: int,
    power_attack: bool,
    power_attack_bonus: int,
    power_attack_penalty: int,
) -> List[ACResult]:
    results = []
    for ac in ac_list:
        normal_had = had(attack_bonus, ac, num_dice, die_sides, modifier,
                          0, 0, advantage, disadvantage, crit_range)
        normal_hit = hit_chance(attack_bonus, ac, 0, advantage, disadvantage)
        normal_crit = crit_chance(attack_bonus, ac, 0, advantage, disadvantage, crit_range)

        power_had_val = power_hit = power_crit = power_total = None
        if power_attack:
            power_had_val = had(attack_bonus, ac, num_dice, die_sides, modifier,
                                 power_attack_bonus, power_attack_penalty,
                                 advantage, disadvantage, crit_range)
            power_hit = hit_chance(attack_bonus, ac, power_attack_penalty, advantage, disadvantage)
            power_crit = crit_chance(attack_bonus, ac, power_attack_penalty,
                                      advantage, disadvantage, crit_range)
            power_total = power_had_val * num_attacks

        results.append(ACResult(
            ac=ac,
            hit_chance=normal_hit,
            crit_chance=normal_crit,
            had=normal_had,
            total_had_per_round=normal_had * num_attacks,
            power_hit_chance=power_hit,
            power_crit_chance=power_crit,
            power_had=power_had_val,
            power_total_had_per_round=power_total,
        ))
    return results
