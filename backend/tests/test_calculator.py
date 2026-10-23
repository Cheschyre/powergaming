"""
Unit tests for the calculation core. These are the same sanity checks used
to validate the original CLI tool, formalized as pytest tests so they run
automatically (and in CI, once that's set up in a later step).
"""

import pytest

from app.calculator import (
    average_damage,
    crit_chance,
    find_power_attack_breakeven,
    had,
    hit_chance,
    once_per_turn_damage,
)


def test_average_damage_basic():
    # 2d6 + 4 -> average die is 3.5
    assert average_damage(2, 6, 4) == pytest.approx(11.0)


def test_average_damage_no_modifier():
    assert average_damage(1, 20, 0) == pytest.approx(10.5)


@pytest.mark.parametrize(
    "attack_bonus,target_ac,expected",
    [
        (5, 15, 0.55),  # need an 10+, i.e. 11 of 20 faces
        (4, 10, 0.75),  # need a 6+
        (10, 25, 0.3),  # need a 15+
        (0, 1, 0.95),  # anything but a nat 1
        (20, 30, 0.55),  # need a 10+
    ],
)
def test_hit_chance_matches_hand_calculation(attack_bonus, target_ac, expected):
    assert hit_chance(attack_bonus, target_ac) == pytest.approx(expected)


def test_hit_chance_nat_1_always_misses():
    # Attack bonus so high that AC would otherwise always be beaten
    assert hit_chance(50, 5) == pytest.approx(0.95)


def test_hit_chance_nat_20_always_hits():
    # AC so high a normal roll could never reach it
    assert hit_chance(0, 100) == pytest.approx(0.05)


def test_advantage_increases_hit_chance():
    flat = hit_chance(5, 15)
    adv = hit_chance(5, 15, advantage=True)
    dis = hit_chance(5, 15, disadvantage=True)
    assert dis < flat < adv


def test_advantage_and_disadvantage_cancel_out():
    flat = hit_chance(5, 15)
    both = hit_chance(5, 15, advantage=True, disadvantage=True)
    assert both == pytest.approx(flat)


def test_crit_chance_default_is_nat_20_only():
    assert crit_chance(5, 15, crit_range=20) == pytest.approx(0.05)


def test_crit_chance_with_advantage():
    # P(at least one of two d20s is a 20) = 1 - 0.95^2
    expected = 1 - 0.95**2
    assert crit_chance(5, 15, crit_range=20, advantage=True) == pytest.approx(expected)


def test_expanded_crit_range_still_requires_beating_ac():
    # Bonus/AC chosen so a natural 19 would NOT beat AC on its own --
    # only the natural 20 (which auto-hits) should count as a crit.
    assert crit_chance(0, 30, crit_range=19) == pytest.approx(0.05)


def test_expanded_crit_range_when_19_also_hits():
    # Now both 19 and 20 beat AC, so both count toward crit chance.
    assert crit_chance(20, 10, crit_range=19) == pytest.approx(0.10)


def test_had_exceeds_naive_no_crit_calculation():
    # HAD should account for the extra crit damage, so it should always be
    # at least as large as a naive "average damage * hit chance" estimate.
    naive = average_damage(2, 6, 4) * hit_chance(5, 15)
    assert had(5, 15, 2, 6, 4) > naive


def test_breakeven_returns_full_ac_range_and_some_crossover():
    results, crossovers = find_power_attack_breakeven(8, 1, 12, 3, 10, -5)
    assert len(results) == 30  # AC 1 through 30 by default
    assert isinstance(crossovers, list)
    # Power attack (-5/+10) should be better at low AC and worse at high AC
    # for this profile, so we expect at least one crossover.
    assert len(crossovers) >= 1


def test_once_per_turn_single_attack_hand_calculation():
    # 65% hit, 5% crit; 3d6 averages 10.5, doubled on a crit to 21:
    # 0.60 * 10.5 + 0.05 * 21 = 7.35.
    chance, expected = once_per_turn_damage([(0.65, 0.05)], 3, 6)
    assert chance == pytest.approx(0.65)
    assert expected == pytest.approx(7.35)


def test_once_per_turn_second_attack_only_counts_if_the_first_missed():
    chance, expected = once_per_turn_damage([(0.65, 0.05), (0.65, 0.05)], 3, 6)
    assert chance == pytest.approx(1 - 0.35**2)
    assert expected == pytest.approx(7.35 + 0.35 * 7.35)


def test_once_per_turn_modifier_is_not_doubled_on_a_crit():
    # Always hits, always crits: 2d4 (avg 5) + 2 flat.
    _, expected = once_per_turn_damage([(1.0, 1.0)], 1, 4, 2)
    assert expected == pytest.approx(7)


def test_once_per_turn_with_no_eligible_attacks_is_zero():
    assert once_per_turn_damage([], 3, 6) == (0.0, 0.0)


def test_once_per_turn_matches_brute_force_over_every_d20_pair():
    """Enumerate every pair of d20 rolls for two different attacks and apply
    the rule literally: the rider goes on the first hit, dice doubled if
    that hit crits."""
    attacks = [  # (attack bonus, crit range) vs AC 16
        (5, 19),
        (9, 20),
    ]
    ac = 16
    normal, crit = 7.0, 14.0  # 2d6 rider

    def outcome(face, bonus, crit_range):
        if face == 1:
            return "miss"
        hits = face == 20 or face + bonus >= ac
        if not hits:
            return "miss"
        return "crit" if face >= crit_range else "hit"

    hits = 0
    total = 0.0
    for f1 in range(1, 21):
        for f2 in range(1, 21):
            for face, (bonus, crit_range) in zip((f1, f2), attacks, strict=True):
                result = outcome(face, bonus, crit_range)
                if result != "miss":
                    total += crit if result == "crit" else normal
                    hits += 1
                    break

    chances = [
        (hit_chance(bonus, ac), crit_chance(bonus, ac, crit_range=crit_range))
        for bonus, crit_range in attacks
    ]
    chance, expected = once_per_turn_damage(chances, 2, 6)
    assert chance == pytest.approx(hits / 400)
    assert expected == pytest.approx(total / 400)
