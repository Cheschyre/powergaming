import { describe, expect, it } from "vitest";
import {
  canDualWield,
  defaultProficiency,
  describeCharacter,
  describeWeapons,
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
    expect(sheet.name).toBe("Vex");
  });
});
