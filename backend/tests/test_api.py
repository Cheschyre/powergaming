"""Integration tests hitting the FastAPI app directly (no server needed)."""

import pytest
from fastapi.testclient import TestClient

from app.calculator import had
from app.main import app

client = TestClient(app)


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


GREATSWORD = {
    "name": "Greatsword",
    "attack_bonus": 8,
    "num_dice": 2,
    "die_sides": 6,
    "modifier": 5,
}
HANDAXE = {"name": "Handaxe", "attack_bonus": 8, "num_dice": 1, "die_sides": 6}


def test_calculate_returns_per_attack_results_and_round_total():
    resp = client.post(
        "/api/calculate",
        json={"ac_list": [12, 15, 18], "attacks": [GREATSWORD, GREATSWORD, HANDAXE]},
    )
    assert resp.status_code == 200

    results = resp.json()["results"]
    assert [r["ac"] for r in results] == [12, 15, 18]
    first = results[0]
    assert len(first["attacks"]) == 3  # same order as the request
    assert first["attacks"][0] == first["attacks"][1]
    assert first["total_had"] == pytest.approx(sum(a["had"] for a in first["attacks"]))
    assert first["total_had_without_power_attack"] is None  # no attack uses it


def test_calculate_known_values():
    # +8 vs AC 15 needs an 8+ (65% plus nat 20 = 70%); 2d6+5 averages 12,
    # a crit adds another 2d6 (7): 0.65 * 12 + 0.05 * 19 = 8.75.
    resp = client.post("/api/calculate", json={"ac_list": [15], "attacks": [GREATSWORD]})
    attack = resp.json()["results"][0]["attacks"][0]
    assert attack["hit_chance"] == pytest.approx(0.70)
    assert attack["crit_chance"] == pytest.approx(0.05)
    assert attack["had"] == pytest.approx(8.75)


def test_power_attack_is_per_attack():
    pa_greatsword = {
        **GREATSWORD,
        "power_attack": True,
        "power_attack_bonus": 10,
        "power_attack_penalty": -5,
    }
    resp = client.post(
        "/api/calculate",
        json={"ac_list": [15], "attacks": [pa_greatsword, GREATSWORD, HANDAXE]},
    )
    result = resp.json()["results"][0]
    pa, plain, axe = result["attacks"]

    # Only the first swing pays the -5 and gets the +10.
    assert pa["hit_chance"] == pytest.approx(0.45)
    assert pa["had"] == pytest.approx(0.40 * 22 + 0.05 * 29)
    assert plain["hit_chance"] == pytest.approx(0.70)
    assert plain["had"] == pytest.approx(8.75)
    assert result["total_had"] == pytest.approx(pa["had"] + plain["had"] + axe["had"])
    # Comparison: the same round with power attack switched off everywhere.
    assert result["total_had_without_power_attack"] == pytest.approx(2 * plain["had"] + axe["had"])


def test_identical_attacks_match_the_old_num_attacks_formula():
    """N identical entries must equal what `num_attacks: N` used to return
    (HAD x N) -- the 0002 migration relies on this to keep saved builds'
    numbers unchanged."""
    for ac in (5, 15, 25):
        old = had(8, ac, 1, 12, 3, 10, -5, True, False, 19) * 3
        entry = {
            "attack_bonus": 8,
            "num_dice": 1,
            "die_sides": 12,
            "modifier": 3,
            "advantage": True,
            "crit_range": 19,
            "power_attack": True,
            "power_attack_bonus": 10,
            "power_attack_penalty": -5,
        }
        resp = client.post("/api/calculate", json={"ac_list": [ac], "attacks": [entry] * 3})
        assert resp.json()["results"][0]["total_had"] == pytest.approx(old)


def test_calculate_rejects_bad_ac():
    resp = client.post("/api/calculate", json={"ac_list": [999], "attacks": [HANDAXE]})
    assert resp.status_code == 422  # FastAPI validation error


@pytest.mark.parametrize("attacks", [[], [HANDAXE] * 21])
def test_calculate_rejects_empty_or_oversized_rounds(attacks):
    resp = client.post("/api/calculate", json={"ac_list": [15], "attacks": attacks})
    assert resp.status_code == 422


def test_calculate_rejects_old_num_attacks_shape():
    # The pre-step-9 single-profile body is no longer accepted.
    resp = client.post(
        "/api/calculate",
        json={"ac_list": [15], "attack_bonus": 5, "num_dice": 1, "die_sides": 6, "num_attacks": 2},
    )
    assert resp.status_code == 422


def test_breakeven_basic():
    payload = {
        "attack_bonus": 8,
        "num_dice": 1,
        "die_sides": 12,
        "modifier": 3,
        "power_attack_bonus": 10,
        "power_attack_penalty": -5,
    }
    resp = client.post("/api/breakeven", json=payload)
    assert resp.status_code == 200

    body = resp.json()
    assert len(body["rows"]) == 30
    assert isinstance(body["crossovers"], list)


def test_breakeven_rejects_inverted_ac_range():
    payload = {
        "attack_bonus": 8,
        "num_dice": 1,
        "die_sides": 12,
        "modifier": 3,
        "power_attack_bonus": 10,
        "power_attack_penalty": -5,
        "ac_min": 20,
        "ac_max": 10,
    }
    resp = client.post("/api/breakeven", json=payload)
    assert resp.status_code == 422
