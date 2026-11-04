"""v0.8: a character's whole-round power-attack breakeven."""

import pytest
from fastapi.testclient import TestClient

from app.calculator import find_power_attack_breakeven
from app.main import app

client = TestClient(app)

PA = {"power_attack": True}


def sheet(**overrides) -> dict:
    base = {
        "name": "Brakka",
        "character_class": "fighter",
        "level": 5,
        "strength": 18,
        "dexterity": 12,
        "main_hand": {"srd_weapon": "greatsword"},
    }
    base.update(overrides)
    return base


def calculate(toggles=None, **overrides) -> dict:
    resp = client.post(
        "/api/characters/calculate",
        json={"character": sheet(**overrides), "toggles": toggles or {}, "ac_list": [15]},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def breakeven(toggles=PA, **overrides):
    return calculate(toggles, **overrides)["power_attack_breakeven"]


def test_none_when_the_toggle_is_off():
    assert breakeven(toggles={}) is None


def test_matches_the_single_attack_breakeven_finder():
    # A level 5 Fighter's round is two identical greatsword swings, so the
    # round's breakeven is the single attack's: +7 to hit, 2d6+4, -5/+10.
    _, crossovers = find_power_attack_breakeven(7, 2, 6, 4, 10, -5)
    assert breakeven() == {"status": "pays_off_up_to", "ac": crossovers[0] - 1}


def test_breakeven_is_where_the_round_totals_cross():
    """Independently: run the round at every AC with and without power
    attack and find the first AC where power attack falls behind."""
    character = sheet(subclass="champion", fighting_style="great_weapon_fighting")
    resp = client.post(
        "/api/characters/calculate",
        json={"character": character, "toggles": PA, "ac_list": list(range(1, 31))},
    ).json()
    first_worse = next(
        r["ac"] for r in resp["results"] if r["total_had"] < r["total_had_without_power_attack"]
    )
    assert resp["power_attack_breakeven"] == {"status": "pays_off_up_to", "ac": first_worse - 1}


def test_advantage_moves_the_breakeven_up():
    plain = breakeven()["ac"]
    with_advantage = breakeven({**PA, "advantage": True})["ac"]
    assert with_advantage > plain


def test_not_applicable_without_a_heavy_or_ranged_weapon():
    assert breakeven(main_hand={"srd_weapon": "longsword"}) == {
        "status": "not_applicable",
        "ac": None,
    }


def test_not_applicable_before_the_feat_is_taken():
    feat = [{"level": 4, "choice": "power_attack_feat"}]
    assert breakeven(level=3, ability_increases=feat)["status"] == "not_applicable"
    assert breakeven(level=4, ability_increases=feat)["status"] == "pays_off_up_to"


def test_always():
    # +27 to hit: even at AC 30 the -5 only costs a few hits, and +10 more
    # than makes up for it.
    assert breakeven(other_to_hit=20)["status"] == "always"


def test_never_when_it_already_loses_at_ac_1():
    # +4 STR +3 proficiency -17 = -10 to hit, 2d6+4 (avg 11). At AC 1:
    #   without: hits on 11+ (45% plain + 5% crit): 0.45*11 + 0.05*18 = 5.85
    #   with:    hits on 16+ (20% plain + 5% crit): 0.20*21 + 0.05*28 = 5.60
    # so it loses from AC 1 on.
    assert breakeven(other_to_hit=-17) == {"status": "never", "ac": None}


def test_only_a_natural_20_hitting_doesnt_count_as_paying_off():
    # -10 to hit vs very high ACs: both only hit on a 20, so power attack
    # comes out ahead again there -- the scan reports where it first stops
    # paying off, not that late "win".
    resp = client.post(
        "/api/characters/calculate",
        json={"character": sheet(other_to_hit=-17), "toggles": PA, "ac_list": [25]},
    ).json()
    top = resp["results"][0]
    assert top["total_had"] > top["total_had_without_power_attack"]
    assert resp["power_attack_breakeven"]["status"] == "never"


def test_level_view_has_a_breakeven_per_level():
    feat = [{"level": 4, "choice": "power_attack_feat"}, {"level": 8, "choice": "strength_2"}]
    rows = client.post(
        "/api/characters/levels",
        json={
            "character": sheet(level=8, strength=16, ability_increases=feat),
            "toggles": PA,
            "ac_list": [15],
        },
    ).json()["rows"]
    by_level = {r["level"]: r["power_attack_breakeven"] for r in rows}
    assert by_level[3]["status"] == "not_applicable"
    assert by_level[4]["status"] == "pays_off_up_to"
    # +2 STR at 8 and proficiency at 9 raise the to-hit, so the breakeven
    # never goes down as the character levels.
    acs = [by_level[level]["ac"] for level in range(4, 21)]
    assert acs == sorted(acs)
    # Each level's value is what a normal run at that level reports.
    level_8 = breakeven(level=8, strength=16, ability_increases=feat)
    assert by_level[8] == level_8


@pytest.mark.parametrize("path", ["/api/characters/{id}/calculate", "/api/characters/{id}/levels"])
def test_saved_character_endpoints_include_it(client, path):
    created = client.post("/api/characters", json=sheet()).json()
    body = client.post(path.format(id=created["id"]), json={"ac_list": [15], "toggles": PA}).json()
    value = body["rows"][4] if "rows" in body else body
    assert value["power_attack_breakeven"]["status"] == "pays_off_up_to"
