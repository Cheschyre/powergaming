"""Character sheet -> attack entries (step 13). Every expected number is
worked out by hand in the comment next to it."""

import pytest
from fastapi.testclient import TestClient

from app.character import (
    ability_modifier,
    champion_crit_range,
    fighter_attacks,
    proficiency_bonus,
    sneak_attack_dice,
)
from app.main import app

client = TestClient(app)


def sheet(**overrides):
    base = {
        "name": "Test",
        "character_class": "fighter",
        "level": 1,
        "strength": 16,
        "dexterity": 14,
        "main_hand": {"srd_weapon": "longsword"},
    }
    base.update(overrides)
    return base


def derive(toggles=None, **overrides):
    body = {"character": sheet(**overrides)}
    if toggles is not None:
        body["toggles"] = toggles
    resp = client.post("/api/characters/derive", json=body)
    assert resp.status_code == 200, resp.text
    return resp.json()


def rejects(**overrides) -> str:
    resp = client.post("/api/characters/derive", json={"character": sheet(**overrides)})
    assert resp.status_code == 422
    return resp.text


# --- Level-based rules ---


@pytest.mark.parametrize(
    ("level", "expected"), [(1, 2), (4, 2), (5, 3), (8, 3), (9, 4), (13, 5), (17, 6), (20, 6)]
)
def test_proficiency_bonus(level, expected):
    assert proficiency_bonus(level) == expected


@pytest.mark.parametrize(
    ("score", "expected"), [(1, -5), (8, -1), (9, -1), (10, 0), (15, 2), (20, 5)]
)
def test_ability_modifier(score, expected):
    assert ability_modifier(score) == expected


@pytest.mark.parametrize(
    ("level", "expected"), [(1, 1), (4, 1), (5, 2), (10, 2), (11, 3), (19, 3), (20, 4)]
)
def test_fighter_extra_attack(level, expected):
    assert fighter_attacks(level) == expected


@pytest.mark.parametrize(("level", "expected"), [(2, 20), (3, 19), (14, 19), (15, 18)])
def test_champion_crit_range(level, expected):
    assert champion_crit_range(level) == expected


@pytest.mark.parametrize(("level", "expected"), [(1, 1), (2, 1), (3, 2), (5, 3), (11, 6), (20, 10)])
def test_sneak_attack_dice(level, expected):
    assert sneak_attack_dice(level) == expected


# --- Fighter ---


def test_level_5_champion_greatsword_with_great_weapon_fighting():
    # STR 18 (+4), proficiency +3: +7 to hit, 2d6+4, two attacks, crits on
    # 19-20, 1s and 2s rerolled.
    round_ = derive(
        level=5,
        strength=18,
        subclass="champion",
        fighting_style="great_weapon_fighting",
        main_hand={"srd_weapon": "greatsword"},
    )
    attacks = round_["attacks"]
    assert len(attacks) == 2 and attacks[0] == attacks[1]
    a = attacks[0]
    assert (a["name"], a["attack_bonus"], a["num_dice"], a["die_sides"], a["modifier"]) == (
        "Greatsword",
        7,
        2,
        6,
        4,
    )
    assert a["crit_range"] == 19
    assert a["reroll_at_or_below"] == 2
    assert round_["once_per_turn"] is None


def test_dueling_one_handed_versus_two_handed_grip():
    # Level 11, STR 16 (+3), proficiency +4: +7 to hit, three attacks.
    # One-handed with Dueling: 1d8 + 3 + 2. Two hands: 1d10 + 3, no Dueling.
    one = derive(level=11, fighting_style="dueling")["attacks"]
    assert len(one) == 3
    assert (one[0]["attack_bonus"], one[0]["die_sides"], one[0]["modifier"]) == (7, 8, 5)

    two = derive(level=11, fighting_style="dueling", two_handed_grip=True)["attacks"]
    assert (two[0]["die_sides"], two[0]["modifier"]) == (10, 3)


def test_great_weapon_fighting_needs_two_hands():
    # A one-handed longsword doesn't get the reroll; in two hands it does.
    assert derive(fighting_style="great_weapon_fighting")["attacks"][0]["reroll_at_or_below"] == 0
    two = derive(fighting_style="great_weapon_fighting", two_handed_grip=True)
    assert two["attacks"][0]["reroll_at_or_below"] == 2


def test_archery_longbow_and_power_attack():
    # Level 1, DEX 18 (+4): 4 + 2 (proficiency) + 2 (Archery) = +8, 1d8+4.
    round_ = derive(
        toggles={"power_attack": True},
        dexterity=18,
        fighting_style="archery",
        main_hand={"srd_weapon": "longbow"},
    )
    a = round_["attacks"][0]
    assert (a["attack_bonus"], a["modifier"]) == (8, 4)
    assert (a["power_attack"], a["power_attack_bonus"], a["power_attack_penalty"]) == (
        True,
        10,
        -5,
    )


def test_power_attack_only_on_heavy_or_ranged_weapons():
    toggles = {"power_attack": True}
    assert derive(toggles)["attacks"][0]["power_attack"] is False  # longsword
    heavy = derive(toggles, main_hand={"srd_weapon": "greataxe"})
    assert heavy["attacks"][0]["power_attack"] is True


def test_magic_weapon_and_other_bonuses():
    # STR 16 (+3), proficiency +2, +1 weapon, other +1 to hit / +2 damage:
    # +7 to hit, 1d8 + 3 + 1 + 2.
    a = derive(
        main_hand={"srd_weapon": "longsword", "magic_bonus": 1},
        other_to_hit=1,
        other_damage=2,
    )["attacks"][0]
    assert a["name"] == "+1 Longsword"
    assert (a["attack_bonus"], a["modifier"]) == (7, 6)


def test_not_proficient_drops_the_proficiency_bonus():
    a = derive(main_hand={"srd_weapon": "longsword", "proficient": False})["attacks"][0]
    assert a["attack_bonus"] == 3


def test_finesse_uses_the_better_of_str_and_dex():
    # STR 10 (+0), DEX 18 (+4): a rapier uses DEX, a longsword STR.
    assert (
        derive(strength=10, dexterity=18, main_hand={"srd_weapon": "rapier"})["attacks"][0][
            "modifier"
        ]
        == 4
    )
    assert derive(strength=10, dexterity=18)["attacks"][0]["modifier"] == 0


def test_round_toggles_reach_every_attack():
    attacks = derive({"advantage": True}, level=5)["attacks"]
    assert all(a["advantage"] and not a["disadvantage"] for a in attacks)


def test_custom_weapon():
    custom = {
        "name": "Sun blade",
        "num_dice": 1,
        "die_sides": 8,
        "finesse": True,
        "versatile_die_sides": 10,
    }
    a = derive(strength=10, dexterity=16, main_hand={"custom": custom, "magic_bonus": 2})[
        "attacks"
    ][0]
    # DEX 16 (+3) + 2 proficiency + 2 magic = +7; 1d8 + 3 + 2.
    assert (a["name"], a["attack_bonus"], a["die_sides"], a["modifier"]) == (
        "+2 Sun blade",
        7,
        8,
        5,
    )


# --- Two-weapon fighting ---


def test_off_hand_attack_drops_a_positive_modifier():
    # Level 5 Fighter, no style, STR 16 (+3) beats DEX 14 (+2) for the
    # finesse shortswords: +6 to hit; main 1d6+3 twice, off-hand 1d6+0.
    attacks = derive(
        level=5,
        main_hand={"srd_weapon": "shortsword"},
        off_hand={"srd_weapon": "shortsword"},
    )["attacks"]
    assert [a["name"] for a in attacks] == ["Shortsword", "Shortsword", "Shortsword (off-hand)"]
    assert [a["modifier"] for a in attacks] == [3, 3, 0]
    assert attacks[2]["attack_bonus"] == attacks[0]["attack_bonus"] == 6


def test_two_weapon_fighting_style_keeps_the_modifier():
    attacks = derive(
        fighting_style="two_weapon_fighting",
        main_hand={"srd_weapon": "handaxe"},
        off_hand={"srd_weapon": "handaxe"},
    )["attacks"]
    assert attacks[-1]["modifier"] == 3


def test_off_hand_keeps_a_negative_modifier():
    # STR 8 (-1), DEX 8 (-1): the off-hand club still takes the -1.
    attacks = derive(
        strength=8,
        dexterity=8,
        main_hand={"srd_weapon": "club"},
        off_hand={"srd_weapon": "club"},
    )["attacks"]
    assert attacks[-1]["modifier"] == -1


def test_dueling_doesnt_apply_with_an_off_hand_weapon():
    attacks = derive(
        fighting_style="dueling",
        main_hand={"srd_weapon": "shortsword"},
        off_hand={"srd_weapon": "dagger"},
    )["attacks"]
    assert attacks[0]["modifier"] == 3


# --- Rogue ---


def test_level_5_two_weapon_rogue_gets_two_chances_at_sneak_attack():
    # DEX 16 (+3), proficiency +3: shortsword +6 1d6+3, dagger off-hand
    # +6 1d4. Sneak Attack 3d6 on either.
    round_ = derive(
        character_class="rogue",
        level=5,
        strength=10,
        dexterity=16,
        main_hand={"srd_weapon": "shortsword"},
        off_hand={"srd_weapon": "dagger"},
    )
    attacks = round_["attacks"]
    assert len(attacks) == 2  # no Extra Attack
    assert [(a["attack_bonus"], a["num_dice"], a["die_sides"], a["modifier"]) for a in attacks] == [
        (6, 1, 6, 3),
        (6, 1, 4, 0),
    ]
    assert all(a["once_per_turn_eligible"] for a in attacks)
    assert round_["once_per_turn"] == {
        "name": "Sneak Attack",
        "num_dice": 3,
        "die_sides": 6,
        "modifier": 0,
    }


def test_sneak_attack_needs_a_finesse_or_ranged_weapon():
    round_ = derive(character_class="rogue", main_hand={"srd_weapon": "mace"})
    assert round_["once_per_turn"] is None
    assert round_["attacks"][0]["once_per_turn_eligible"] is False


def test_sneak_attack_can_be_switched_off():
    round_ = derive(
        character_class="rogue", main_hand={"srd_weapon": "rapier"}, sneak_attack_can_trigger=False
    )
    assert round_["once_per_turn"] is None
    assert round_["attacks"][0]["once_per_turn_eligible"] is False


def test_fighter_flags_no_sneak_attack():
    assert (
        derive(main_hand={"srd_weapon": "rapier"})["attacks"][0]["once_per_turn_eligible"] is False
    )


# --- Validation ---


def test_rogue_has_no_fighting_style_or_subclass_option():
    assert "fighting style" in rejects(character_class="rogue", fighting_style="archery")
    assert "subclass" in rejects(character_class="rogue", subclass="champion")


def test_two_handed_grip_needs_a_versatile_weapon_and_a_free_hand():
    assert "isn't versatile" in rejects(main_hand={"srd_weapon": "rapier"}, two_handed_grip=True)
    assert "no hand" in rejects(
        main_hand={"srd_weapon": "longsword"},
        off_hand={"srd_weapon": "dagger"},
        two_handed_grip=True,
    )


@pytest.mark.parametrize(
    ("main", "off"),
    [
        ("greatsword", "dagger"),  # two-handed main weapon
        ("longsword", "dagger"),  # main not light
        ("shortsword", "rapier"),  # off-hand not light
        ("shortsword", "hand_crossbow"),  # light, but ranged
    ],
)
def test_two_weapon_fighting_needs_light_melee_weapons(main, off):
    rejects(main_hand={"srd_weapon": main}, off_hand={"srd_weapon": off})


def test_weapon_choice_must_be_exactly_one_known_weapon():
    assert "Unknown SRD weapon" in rejects(main_hand={"srd_weapon": "vorpal_sword"})
    rejects(main_hand={})
    rejects(
        main_hand={
            "srd_weapon": "dagger",
            "custom": {"name": "x", "num_dice": 1, "die_sides": 4},
        }
    )


@pytest.mark.parametrize("field", [{"level": 0}, {"level": 21}, {"strength": 31}, {"dexterity": 0}])
def test_rejects_out_of_range_numbers(field):
    rejects(**field)


# --- Endpoints ---


def test_calculate_matches_api_calculate_on_the_derived_round():
    body = {
        "character": sheet(
            character_class="rogue",
            level=5,
            dexterity=16,
            main_hand={"srd_weapon": "shortsword"},
            off_hand={"srd_weapon": "dagger"},
        ),
        "ac_list": [13, 16],
    }
    resp = client.post("/api/characters/calculate", json=body)
    assert resp.status_code == 200
    got = resp.json()
    direct = client.post(
        "/api/calculate",
        json={
            "ac_list": [13, 16],
            "attacks": got["attacks"],
            "once_per_turn": got["once_per_turn"],
        },
    ).json()
    assert got["results"] == direct["results"]
    assert got["results"][0]["once_per_turn"]["had"] > 0


def test_srd_weapons_endpoint():
    weapons = {w["key"]: w for w in client.get("/api/srd/weapons").json()}
    assert len(weapons) == 35
    assert weapons["greatsword"] == {
        "key": "greatsword",
        "name": "Greatsword",
        "category": "martial",
        "num_dice": 2,
        "die_sides": 6,
        "versatile_die_sides": None,
        "finesse": False,
        "light": False,
        "heavy": True,
        "two_handed": True,
        "ranged": False,
    }
    assert weapons["longsword"]["versatile_die_sides"] == 10
    assert "net" not in weapons and "blowgun" not in weapons
