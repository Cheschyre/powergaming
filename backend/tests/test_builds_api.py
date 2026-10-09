"""Integration tests for the saved-builds CRUD endpoints and the
per-build calculate endpoint."""


def _sample_build(**overrides):
    build = {
        "name": "GWM Fighter",
        "attack_bonus": 8,
        "num_dice": 1,
        "die_sides": 12,
        "modifier": 3,
        "num_attacks": 2,
        "power_attack": True,
        "power_attack_bonus": 10,
        "power_attack_penalty": -5,
    }
    build.update(overrides)
    return build


def test_create_build(client):
    resp = client.post("/api/builds", json=_sample_build())
    assert resp.status_code == 201

    body = resp.json()
    assert body["name"] == "GWM Fighter"
    assert body["attack_bonus"] == 8
    assert "id" in body
    assert "created_at" in body


def test_get_build(client):
    build_id = client.post("/api/builds", json=_sample_build()).json()["id"]

    resp = client.get(f"/api/builds/{build_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == build_id


def test_get_missing_build_404(client):
    resp = client.get("/api/builds/999")
    assert resp.status_code == 404


def test_list_builds(client):
    client.post("/api/builds", json=_sample_build())
    client.post("/api/builds", json=_sample_build(name="Sharpshooter"))

    resp = client.get("/api/builds")
    assert resp.status_code == 200
    names = {b["name"] for b in resp.json()}
    assert names == {"GWM Fighter", "Sharpshooter"}


def test_update_build_partial(client):
    build_id = client.post("/api/builds", json=_sample_build()).json()["id"]

    resp = client.patch(f"/api/builds/{build_id}", json={"attack_bonus": 9})
    assert resp.status_code == 200

    body = resp.json()
    assert body["attack_bonus"] == 9
    assert body["name"] == "GWM Fighter"  # untouched fields stay as they were


def test_update_missing_build_404(client):
    resp = client.patch("/api/builds/999", json={"attack_bonus": 9})
    assert resp.status_code == 404


def test_delete_build(client):
    build_id = client.post("/api/builds", json=_sample_build()).json()["id"]

    resp = client.delete(f"/api/builds/{build_id}")
    assert resp.status_code == 204

    resp = client.get(f"/api/builds/{build_id}")
    assert resp.status_code == 404


def test_calculate_for_build_uses_stored_profile(client):
    build_id = client.post("/api/builds", json=_sample_build()).json()["id"]

    resp = client.post(f"/api/builds/{build_id}/calculate", json={"ac_list": [12, 18]})
    assert resp.status_code == 200

    results = resp.json()["results"]
    assert len(results) == 2
    # power_attack=True on the saved build, so power numbers should be populated
    assert results[0]["power_had"] is not None
    assert results[1]["power_had"] is not None


def test_calculate_for_build_without_power_attack(client):
    build_id = client.post("/api/builds", json=_sample_build(power_attack=False)).json()["id"]

    resp = client.post(f"/api/builds/{build_id}/calculate", json={"ac_list": [15]})
    assert resp.status_code == 200
    assert resp.json()["results"][0]["power_had"] is None


def test_calculate_for_missing_build_404(client):
    resp = client.post("/api/builds/999/calculate", json={"ac_list": [15]})
    assert resp.status_code == 404
