import { describe, expect, it } from "vitest";
import { attackKey, describeAttack, groupAttacks, groupLabel, newAttack } from "./attacks";

const greatsword = newAttack({ name: "Greatsword", attack_bonus: 8, num_dice: 2, die_sides: 6, modifier: 5 });
const handaxe = newAttack({ name: "Handaxe", attack_bonus: 8, num_dice: 1, die_sides: 6, modifier: 0 });

describe("groupAttacks", () => {
  it("puts identical attacks in one group, in order of first appearance", () => {
    const groups = groupAttacks([greatsword, handaxe, { ...greatsword }]);
    expect(groups.map((g) => [g.attack.name, g.indices])).toEqual([
      ["Greatsword", [0, 2]],
      ["Handaxe", [1]],
    ]);
  });

  it("splits attacks that differ in any setting, including power attack", () => {
    const pa = { ...greatsword, power_attack: true };
    expect(groupAttacks([greatsword, pa, greatsword]).map((g) => g.indices)).toEqual([[0, 2], [1]]);
    expect(groupAttacks([greatsword, { ...greatsword, crit_range: 19 }])).toHaveLength(2);
  });

  it("ignores power-attack numbers while power attack is off", () => {
    const leftover = { ...greatsword, power_attack_bonus: 3 };
    expect(attackKey(leftover)).toBe(attackKey(greatsword));
    expect(attackKey({ ...leftover, power_attack: true })).not.toBe(
      attackKey({ ...greatsword, power_attack: true }),
    );
  });
});

describe("labels", () => {
  it("describes an attack compactly", () => {
    expect(describeAttack(greatsword)).toBe("+8, 2d6+5");
    expect(describeAttack(handaxe)).toBe("+8, 1d6");
    expect(
      describeAttack({ ...greatsword, crit_range: 19, advantage: true, power_attack: true }),
    ).toBe("+8, 2d6+5, crit 19–20, adv, PA +10/−5");
    expect(describeAttack({ ...handaxe, attack_bonus: -1, modifier: -1 })).toBe("-1, 1d6-1");
    // Advantage and disadvantage together cancel out.
    expect(describeAttack({ ...handaxe, advantage: true, disadvantage: true })).toBe("+8, 1d6");
  });

  it("labels groups with power attack and count", () => {
    const [two, one] = groupAttacks([{ ...greatsword, power_attack: true }, { ...greatsword, power_attack: true }, handaxe]);
    expect(groupLabel(two)).toBe("Greatsword (PA) ×2");
    expect(groupLabel(one)).toBe("Handaxe");
  });
});
