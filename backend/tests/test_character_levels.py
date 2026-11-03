"""v0.7: ability score improvements, feats taken at a level, and the level
1-20 view. Expected numbers are worked out by hand next to them."""

import pytest
from fastapi.testclient import TestClient

from app.character import derive_round, level_rows
from app.main import app
from app.schemas import CharacterSheet, RoundToggles

client = TestClient(app)


def sheet(**overrides) -> dict:
    base = {
        "name": "Test",
        "character_class": "fighter",
        "level": 1,
        "strength": 15,
        "dexterity": 14,
        "main_hand": {"srd_weapon": "longsword"},
    }
    base.update(overrides)
    return base


def asi(*pairs) -> list[dict]:
    return [{"level": level, "choice": choice} for level, choice in pairs]


def derive_at(level: int, toggles=None, **overrides) -> dict:
    s = CharacterSheet(**sheet(**overrides))
    return derive_round(s, RoundToggles(**(toggles or {})), level=level).model_dump()


def rejects(**overrides) -> str:
    resp = client.post("/api/characters/derive", json={"character": sheet(**overrides)})
    assert resp.status_code == 422
    return resp.text


def rows(toggles=None, ac_list=(15,), **overrides) -> list[dict]:
    resp = client.post(
        "/api/characters/levels",
        json={"character": sheet(**overrides), "toggles": toggles or {}, "ac_list": list(ac_list)},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["rows"]


# --- Ability scores by level ---

FIGHTER_PLAN = asi(
    (4, "strength_2"), (6, "strength_dexterity"), (8, "strength_2"), (12, "strength_2")
)


@pytest.mark.parametrize(
    ("level", "strength", "dexterity"),
    [
        (3, 15, 14),  # nothing yet
        (4, 17, 14),  # +2 STR
        (6, 18, 15),  # +1/+1
        (8, 20, 15),  # +2 STR
        (12, 20, 15),  # +2 STR again, but 20 is the cap
    ],
)
def test_scores_add_up_by_level(level, strength, dexterity):
    by_level = {r["level"]: r for r in rows(ability_increases=FIGHTER_PLAN)}
    assert (by_level[level]["strength"], by_level[level]["dexterity"]) == (strength, dexterity)


def test_increase_stops_at_20_but_magic_scores_above_it_stay():
    assert rows(strength=19, ability_increases=asi((4, "strength_2")))[3]["strength"] == 20
    assert rows(strength=22, ability_increases=asi((4, "strength_2")))[3]["strength"] == 22


def test_attacks_use_the_scores_at_that_level():
    # Level 8: STR 20 (+5), proficiency +3 -> +8 to hit, 1d8+5.
    a = derive_at(8, ability_increases=FIGHTER_PLAN)["attacks"][0]
    assert (a["attack_bonus"], a["modifier"]) == (8, 5)
    # Level 3: STR 15 (+2), proficiency +2 -> +4, 1d8+2.
    a = derive_at(3, ability_increases=FIGHTER_PLAN)["attacks"][0]
    assert (a["attack_bonus"], a["modifier"]) == (4, 2)


def test_saved_character_reports_its_current_scores(client):
    body = client.post(
        "/api/characters", json=sheet(level=6, ability_increases=FIGHTER_PLAN)
    ).json()
    assert body["current_scores"] == {"strength": 18, "dexterity": 15}
    assert body["strength"] == 15  # the starting score is kept as entered
    # A normal run uses the current scores: STR 18 (+4) + 3 = +7.
    run = client.post(f"/api/characters/{body['id']}/calculate", json={"ac_list": [15]}).json()
    assert run["attacks"][0]["attack_bonus"] == 7


def test_characters_without_increases_keep_their_numbers():
    assert {r["strength"] for r in rows()} == {15}
    assert {r["dexterity"] for r in rows()} == {14}


# --- Feats ---


def test_elven_accuracy_from_the_level_taken_on_dex_attacks():
    rogue = dict(
        character_class="rogue",
        strength=10,
        dexterity=16,
        main_hand={"srd_weapon": "rapier"},
        ability_increases=asi((4, "elven_accuracy")),
    )
    before = derive_at(3, **rogue)["attacks"][0]
    after = derive_at(4, **rogue)["attacks"][0]
    assert before["super_advantage"] is False
    # +1 DEX: 16 -> 17, modifier still +3.
    assert after["super_advantage"] is True
    assert after["modifier"] == 3


def test_elven_accuracy_never_applies_to_str_attacks():
    plan = asi((4, "elven_accuracy"))
    # A longsword always uses STR.
    assert derive_at(4, ability_increases=plan)["attacks"][0]["super_advantage"] is False
    # A finesse weapon where STR is better uses STR -- no Elven Accuracy.
    rapier = {"srd_weapon": "rapier"}
    strong = derive_at(4, strength=18, dexterity=12, main_hand=rapier, ability_increases=plan)
    assert strong["attacks"][0]["super_advantage"] is False
    # On a tie the finesse weapon uses DEX, so Elven Accuracy counts.
    # (DEX 13 + 1 = 14 ties STR 14.)
    tie = derive_at(4, strength=14, dexterity=13, main_hand=rapier, ability_increases=plan)
    assert tie["attacks"][0]["super_advantage"] is True


def test_elven_accuracy_rolls_3d20_only_with_advantage():
    plan = asi((4, "elven_accuracy"))
    bow = {"srd_weapon": "longbow"}
    # DEX 17 + 1 = 18 at level 4 (+4), +2 proficiency = +6 vs AC 15: needs a 9.
    plain = derive_at(4, dexterity=17, main_hand=bow, ability_increases=plan)["attacks"]
    with_adv = derive_at(
        4, {"advantage": True}, dexterity=17, main_hand=bow, ability_increases=plan
    )["attacks"]

    def calc(attacks):
        resp = client.post("/api/calculate", json={"ac_list": [15], "attacks": attacks})
        return resp.json()["results"][0]["attacks"][0]["hit_chance"]

    assert calc(plain) == pytest.approx(0.6)  # 9-20, straight roll
    assert calc(with_adv) == pytest.approx(1 - (8 / 20) ** 3)  # three dice


def test_power_attack_feat_applies_from_the_level_taken():
    gwm = dict(
        main_hand={"srd_weapon": "greatsword"}, ability_increases=asi((4, "power_attack_feat"))
    )
    toggles = {"power_attack": True}
    assert derive_at(3, toggles, **gwm)["attacks"][0]["power_attack"] is False
    assert derive_at(4, toggles, **gwm)["attacks"][0]["power_attack"] is True


def test_without_a_recorded_feat_power_attack_applies_at_every_level():
    greatsword = {"srd_weapon": "greatsword"}
    a = derive_at(1, {"power_attack": True}, main_hand=greatsword)["attacks"][0]
    assert a["power_attack"] is True


# --- Validation ---


def test_increases_only_at_the_class_asi_levels():
    # Fighters get one at 6; Rogues don't.
    derive_at(6, ability_increases=asi((6, "strength_2")))
    text = rejects(character_class="rogue", ability_increases=asi((6, "dexterity_2")))
    assert "Rogues get Ability Score Improvements at levels 4, 8, 10, 12, 16, 19" in text
    assert "not 6" in text


def test_one_choice_per_level_and_each_feat_once():
    assert "one Ability Score Improvement choice per level" in rejects(
        ability_increases=asi((4, "strength_2"), (4, "dexterity_2"))
    )
    assert "only be taken once" in rejects(
        ability_increases=asi((4, "elven_accuracy"), (8, "elven_accuracy"))
    )
    # "Other feat" can be taken more than once.
    derive_at(8, ability_increases=asi((4, "other_feat"), (8, "other_feat")))


# --- Level notes and the level view ---


def test_level_notes_for_a_champion():
    plan = asi((4, "strength_2"), (6, "power_attack_feat"))
    notes = {r["level"]: r["notes"] for r in rows(subclass="champion", ability_increases=plan)}
    assert notes[1] == []
    assert notes[3] == ["Improved Critical (19-20)"]
    assert notes[4] == ["+2 STR"]
    assert notes[5] == ["Proficiency +3", "Extra Attack"]
    assert notes[6] == ["Power attack feat"]
    assert notes[11] == ["Extra Attack (3 attacks)"]
    assert notes[15] == ["Superior Critical (18-20)"]
    assert notes[20] == ["Extra Attack (4 attacks)"]


def test_level_notes_for_a_rogue():
    notes = {
        r["level"]: r["notes"]
        for r in rows(character_class="rogue", main_hand={"srd_weapon": "rapier"})
    }
    assert notes[2] == []
    assert notes[3] == ["Sneak Attack 2d6"]
    assert notes[19] == ["Sneak Attack 10d6"]


def test_every_row_matches_a_normal_run_at_that_level():
    character = sheet(
        character_class="rogue",
        strength=10,
        dexterity=16,
        main_hand={"srd_weapon": "shortsword"},
        off_hand={"srd_weapon": "dagger"},
        ability_increases=asi((4, "dexterity_2"), (8, "elven_accuracy")),
    )
    toggles = {"advantage": True}
    level_view = client.post(
        "/api/characters/levels",
        json={"character": character, "toggles": toggles, "ac_list": [13, 17]},
    ).json()["rows"]
    assert [r["level"] for r in level_view] == list(range(1, 21))
    for row in level_view:
        run = client.post(
            "/api/characters/calculate",
            json={
                "character": {**character, "level": row["level"]},
                "toggles": toggles,
                "ac_list": [13, 17],
            },
        ).json()
        assert row["attacks"] == run["attacks"]
        assert row["results"] == run["results"]


def test_saved_character_level_view(client):
    created = client.post("/api/characters", json=sheet(ability_increases=FIGHTER_PLAN)).json()
    resp = client.post(f"/api/characters/{created['id']}/levels", json={"ac_list": [13, 15, 17]})
    assert resp.status_code == 200
    body = resp.json()["rows"]
    assert len(body) == 20 and len(body[0]["results"]) == 3
    assert client.post("/api/characters/999/levels", json={"ac_list": [15]}).status_code == 404


def test_level_view_takes_at_most_3_acs():
    resp = client.post(
        "/api/characters/levels", json={"character": sheet(), "ac_list": [11, 13, 15, 17]}
    )
    assert resp.status_code == 422


def test_level_rows_directly():
    # Damage per round never drops as a plain fighter levels up (no feat
    # trade-offs here): proficiency, scores and Extra Attack only add.
    s = CharacterSheet(**sheet(ability_increases=FIGHTER_PLAN))
    totals = [r.results[0].total_had for r in level_rows(s, RoundToggles(), [15])]
    assert totals == sorted(totals)
