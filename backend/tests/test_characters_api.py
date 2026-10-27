"""Saved characters (step 13): CRUD, calculating a saved character, and
saving its round as a build."""

import pytest

ROGUE = {
    "name": "Vex",
    "character_class": "rogue",
    "level": 5,
    "strength": 10,
    "dexterity": 16,
    "main_hand": {"srd_weapon": "shortsword"},
    "off_hand": {"srd_weapon": "dagger"},
}

FIGHTER = {
    "name": "Brakka",
    "character_class": "fighter",
    "level": 5,
    "strength": 18,
    "dexterity": 12,
    "main_hand": {"srd_weapon": "greatsword"},
    "fighting_style": "great_weapon_fighting",
    "subclass": "champion",
}


def _create(client, sheet=ROGUE) -> dict:
    resp = client.post("/api/characters", json=sheet)
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_create_returns_the_full_sheet_with_defaults(client):
    body = _create(client)
    assert body["name"] == "Vex"
    assert body["main_hand"] == {
        "srd_weapon": "shortsword",
        "custom": None,
        "magic_bonus": 0,
        "proficient": True,
    }
    assert body["fighting_style"] == "none"
    assert body["sneak_attack_can_trigger"] is True
    assert {"id", "created_at", "updated_at"} <= body.keys()


def test_get_and_list(client):
    rogue = _create(client)
    _create(client, FIGHTER)

    assert client.get(f"/api/characters/{rogue['id']}").json() == rogue
    names = [c["name"] for c in client.get("/api/characters").json()]
    assert names == ["Vex", "Brakka"]


def test_create_rejects_invalid_sheets(client):
    resp = client.post("/api/characters", json={**ROGUE, "fighting_style": "archery"})
    assert resp.status_code == 422
    assert client.get("/api/characters").json() == []


def test_put_replaces_the_whole_sheet(client):
    rogue = _create(client)
    updated = {**ROGUE, "name": "Vex the Bold", "level": 6, "off_hand": None}

    resp = client.put(f"/api/characters/{rogue['id']}", json=updated)
    assert resp.status_code == 200
    body = resp.json()
    assert (body["name"], body["level"], body["off_hand"]) == ("Vex the Bold", 6, None)
    assert client.get(f"/api/characters/{rogue['id']}").json()["level"] == 6


def test_put_rejects_an_invalid_sheet_and_keeps_the_old_one(client):
    rogue = _create(client)
    resp = client.put(
        f"/api/characters/{rogue['id']}",
        json={**ROGUE, "main_hand": {"srd_weapon": "greatsword"}},  # two-handed + off-hand
    )
    assert resp.status_code == 422
    assert client.get(f"/api/characters/{rogue['id']}").json() == rogue


def test_delete(client):
    rogue = _create(client)
    assert client.delete(f"/api/characters/{rogue['id']}").status_code == 204
    assert client.get(f"/api/characters/{rogue['id']}").status_code == 404


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("get", "/api/characters/999", None),
        ("put", "/api/characters/999", ROGUE),
        ("delete", "/api/characters/999", None),
        ("post", "/api/characters/999/calculate", {"ac_list": [15]}),
        ("post", "/api/characters/999/save-as-build", {}),
    ],
)
def test_missing_character_404(client, method, path, body):
    kwargs = {"json": body} if body is not None else {}
    assert getattr(client, method)(path, **kwargs).status_code == 404


def test_calculate_saved_character_matches_calculating_the_sheet(client):
    fighter = _create(client, FIGHTER)
    toggles = {"power_attack": True}

    saved = client.post(
        f"/api/characters/{fighter['id']}/calculate",
        json={"ac_list": [14, 18], "toggles": toggles},
    )
    assert saved.status_code == 200
    inline = client.post(
        "/api/characters/calculate",
        json={"character": FIGHTER, "ac_list": [14, 18], "toggles": toggles},
    )
    assert saved.json() == inline.json()
    assert saved.json()["attacks"][0]["power_attack"] is True


def test_calculate_saved_character_validates_acs(client):
    fighter = _create(client, FIGHTER)
    resp = client.post(f"/api/characters/{fighter['id']}/calculate", json={"ac_list": [0]})
    assert resp.status_code == 422


def test_save_as_build_snapshots_the_derived_round(client):
    rogue = _create(client)

    resp = client.post(f"/api/characters/{rogue['id']}/save-as-build", json={})
    assert resp.status_code == 201
    build = resp.json()
    assert build["name"] == "Vex (level 5)"
    assert [a["name"] for a in build["attacks"]] == ["Shortsword", "Dagger (off-hand)"]
    assert build["once_per_turn"]["num_dice"] == 3

    # Running the build gives the character's numbers.
    as_build = client.post(f"/api/builds/{build['id']}/calculate", json={"ac_list": [15]})
    as_character = client.post(f"/api/characters/{rogue['id']}/calculate", json={"ac_list": [15]})
    assert as_build.json()["results"] == as_character.json()["results"]

    # A snapshot: levelling the character up doesn't change the build.
    client.put(f"/api/characters/{rogue['id']}", json={**ROGUE, "level": 7})
    assert client.get(f"/api/builds/{build['id']}").json()["once_per_turn"]["num_dice"] == 3


def test_save_as_build_with_a_name_and_toggles(client):
    fighter = _create(client, FIGHTER)
    resp = client.post(
        f"/api/characters/{fighter['id']}/save-as-build",
        json={"name": "Brakka, GWM on", "toggles": {"power_attack": True, "advantage": True}},
    )
    build = resp.json()
    assert build["name"] == "Brakka, GWM on"
    assert all(a["power_attack"] and a["advantage"] for a in build["attacks"])
