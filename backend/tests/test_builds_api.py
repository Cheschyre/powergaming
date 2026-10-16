"""Integration tests for the saved-builds CRUD endpoints and the
per-build calculate endpoint."""

GREATSWORD = {
    "name": "Greatsword",
    "attack_bonus": 8,
    "num_dice": 2,
    "die_sides": 6,
    "modifier": 5,
    "power_attack": True,
    "power_attack_bonus": 10,
    "power_attack_penalty": -5,
}


def _sample_build(**overrides):
    build = {"name": "GWM Fighter", "attacks": [GREATSWORD, GREATSWORD]}
    build.update(overrides)
    return build


def test_create_build(client):
    resp = client.post("/api/builds", json=_sample_build())
    assert resp.status_code == 201

    body = resp.json()
    assert body["name"] == "GWM Fighter"
    assert len(body["attacks"]) == 2
    # Defaults are filled in and returned on every entry.
    assert body["attacks"][0] == {
        **GREATSWORD,
        "crit_range": 20,
        "advantage": False,
        "disadvantage": False,
    }
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

    resp = client.patch(f"/api/builds/{build_id}", json={"name": "Renamed"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Renamed"
    assert len(body["attacks"]) == 2  # untouched fields stay as they were


def test_update_build_replaces_attack_list(client):
    build_id = client.post("/api/builds", json=_sample_build()).json()["id"]
    handaxe = {"name": "Handaxe", "attack_bonus": 8, "num_dice": 1, "die_sides": 6}

    resp = client.patch(f"/api/builds/{build_id}", json={"attacks": [GREATSWORD, handaxe]})
    assert resp.status_code == 200
    assert [a["name"] for a in resp.json()["attacks"]] == ["Greatsword", "Handaxe"]
    assert [a["name"] for a in client.get(f"/api/builds/{build_id}").json()["attacks"]] == [
        "Greatsword",
        "Handaxe",
    ]


def test_update_build_rejects_empty_attack_list(client):
    build_id = client.post("/api/builds", json=_sample_build()).json()["id"]
    resp = client.patch(f"/api/builds/{build_id}", json={"attacks": []})
    assert resp.status_code == 422


def test_update_missing_build_404(client):
    resp = client.patch("/api/builds/999", json={"name": "x"})
    assert resp.status_code == 404


def test_delete_build(client):
    build_id = client.post("/api/builds", json=_sample_build()).json()["id"]

    resp = client.delete(f"/api/builds/{build_id}")
    assert resp.status_code == 204

    resp = client.get(f"/api/builds/{build_id}")
    assert resp.status_code == 404


def test_calculate_for_build_matches_calculate(client):
    """Running a saved build is exactly /api/calculate on its stored attacks."""
    build = _sample_build()
    build_id = client.post("/api/builds", json=build).json()["id"]

    resp = client.post(f"/api/builds/{build_id}/calculate", json={"ac_list": [12, 18]})
    assert resp.status_code == 200
    direct = client.post(
        "/api/calculate", json={"ac_list": [12, 18], "attacks": build["attacks"]}
    ).json()
    assert resp.json() == direct
    assert resp.json()["results"][0]["total_had_without_power_attack"] is not None


def test_calculate_for_build_rejects_bad_ac(client):
    build_id = client.post("/api/builds", json=_sample_build()).json()["id"]
    resp = client.post(f"/api/builds/{build_id}/calculate", json={"ac_list": [0]})
    assert resp.status_code == 422


def test_calculate_for_missing_build_404(client):
    resp = client.post("/api/builds/999/calculate", json={"ac_list": [15]})
    assert resp.status_code == 404
