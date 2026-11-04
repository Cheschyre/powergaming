import { describe, expect, it } from "vitest";
import {
  canDualWield,
  defaultProficiency,
  describeCharacter,
  describeWeapons,
  featsTaken,
  scoresAtLevel,
  srdChoice,
  toSheet,
  weaponLabel,
  weaponTable,
} from "./characters";
import { character, srdWeapons } from "./test/fixtures";

const weapons = weaponTable(srdWeapons);

describe("defaultProficiency (2014)", () => {
  it("Fighters are proficient with everything", () => {
    expect(
      defaultProficiency("fighter", srdChoice("greatsword"), weapons),
    ).toBe(true);
  });

  it("Rogues: simple weapons plus hand crossbows, longswords, rapiers, shortswords", () => {
    for (const key of [
      "dagger",
      "mace",
      "hand_crossbow",
      "longsword",
      "rapier",
      "shortsword",
    ]) {
      expect(defaultProficiency("rogue", srdChoice(key), weapons)).toBe(true);
    }
    for (const key of ["greatsword", "scimitar", "longbow"]) {
      expect(defaultProficiency("rogue", srdChoice(key), weapons)).toBe(false);
    }
  });

  it("assumes proficiency with a custom weapon", () => {
    const custom = {
      srd_weapon: null,
      custom: { ...srdWeapons[0], name: "Odd" },
      magic_bonus: 0,
      proficient: true,
    };
    expect(defaultProficiency("rogue", custom, weapons)).toBe(true);
  });
});

describe("labels", () => {
  it("describes a character and its weapons", () => {
    const rogue = character();
    expect(describeCharacter(rogue)).toBe("Level 5 Rogue");
    expect(describeWeapons(rogue, weapons)).toBe("Shortsword + Dagger");

    const champion = character({
      character_class: "fighter",
      subclass: "champion",
      main_hand: { ...srdChoice("longsword"), magic_bonus: 1 },
      off_hand: null,
      two_handed_grip: true,
    });
    expect(describeCharacter(champion)).toBe("Level 5 Fighter (Champion)");
    expect(describeWeapons(champion, weapons)).toBe("+1 Longsword (two hands)");
    expect(weaponLabel(srdChoice("rapier"), weapons)).toBe("Rapier");
  });

  it("only light melee weapons can be dual-wielded", () => {
    expect(canDualWield(weapons.get("dagger"))).toBe(true);
    expect(canDualWield(weapons.get("rapier"))).toBe(false);
    expect(canDualWield(weapons.get("hand_crossbow"))).toBe(false);
  });

  it("toSheet drops the saved-record fields", () => {
    const sheet = toSheet(character());
    expect(sheet).not.toHaveProperty("id");
    expect(sheet).not.toHaveProperty("created_at");
    expect(sheet).not.toHaveProperty("current_scores");
    expect(sheet.name).toBe("Vex");
  });
});

describe("scores by level (same rule as the server)", () => {
  const base = character({
    character_class: "fighter",
    strength: 15,
    dexterity: 14,
    ability_increases: [
      { level: 4, choice: "strength_2" },
      { level: 6, choice: "strength_dexterity" },
      { level: 8, choice: "strength_2" },
      { level: 12, choice: "strength_2" },
    ],
  });

  it.each([
    [3, 15, 14],
    [4, 17, 14],
    [6, 18, 15],
    [8, 20, 15],
    [12, 20, 15], // capped at 20
  ])("level %i: STR %i, DEX %i", (level, strength, dexterity) => {
    expect(scoresAtLevel(base, level)).toEqual({ strength, dexterity });
  });

  it("leaves a score above 20 (magic) alone and treats a missing plan as none", () => {
    const strong = character({
      strength: 22,
      ability_increases: [{ level: 4, choice: "strength_2" }],
    });
    expect(scoresAtLevel(strong, 4).strength).toBe(22);
    expect(
      scoresAtLevel({ ...character(), ability_increases: undefined }, 20),
    ).toEqual({
      strength: 10,
      dexterity: 16,
    });
  });

  it("lists modeled feats taken by the current level", () => {
    const rogue = character({
      level: 8,
      ability_increases: [
        { level: 4, choice: "elven_accuracy" },
        { level: 8, choice: "other_feat" },
        { level: 12, choice: "power_attack_feat" }, // planned, not taken yet
      ],
    });
    expect(featsTaken(rogue)).toEqual(["Elven Accuracy"]);
  });
});
