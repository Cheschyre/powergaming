"""Integration tests hitting the FastAPI app directly (no server needed)."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_calculate_basic():
    payload = {
        "attack_bonus": 5,
        "ac_list": [12, 15, 18],
        "num_dice": 2,
        "die_sides": 6,
        "modifier": 4,
        "num_attacks": 2,
    }
    resp = client.post("/api/calculate", json=payload)
    assert resp.status_code == 200

    body = resp.json()
    assert len(body["results"]) == 3
    first = body["results"][0]
    assert first["ac"] == 12
    assert 0 <= first["hit_chance"] <= 1
    assert first["power_had"] is None  # power attack not requested


def test_calculate_with_power_attack():
    payload = {
        "attack_bonus": 8,
        "ac_list": [15],
        "num_dice": 1,
        "die_sides": 12,
        "modifier": 3,
        "num_attacks": 2,
        "power_attack": True,
        "power_attack_bonus": 10,
        "power_attack_penalty": -5,
    }
    resp = client.post("/api/calculate", json=payload)
    assert resp.status_code == 200

    result = resp.json()["results"][0]
    assert result["power_had"] is not None
    assert result["power_hit_chance"] is not None


def test_calculate_rejects_bad_ac():
    payload = {
        "attack_bonus": 5,
        "ac_list": [999],  # out of range
        "num_dice": 1,
        "die_sides": 6,
    }
    resp = client.post("/api/calculate", json=payload)
    assert resp.status_code == 422  # FastAPI validation error


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
