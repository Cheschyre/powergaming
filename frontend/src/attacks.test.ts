import { describe, expect, it } from "vitest";
import {
  attackKey,
  describeAttack,
  describeOncePerTurn,
  eligibleAttackNames,
  groupAttacks,
  groupLabel,
  newAttack,
  newOncePerTurn,
  roundProblem,
} from "./attacks";

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

  it("splits on the step 12 options, but ignores 3d20 without advantage", () => {
    expect(attackKey({ ...greatsword, extra_crit_dice: 1 })).not.toBe(attackKey(greatsword));
    expect(attackKey({ ...greatsword, reroll_at_or_below: 2 })).not.toBe(attackKey(greatsword));
    expect(attackKey({ ...greatsword, super_advantage: true })).toBe(attackKey(greatsword));
    const adv = { ...greatsword, advantage: true };
    expect(attackKey({ ...adv, super_advantage: true })).not.toBe(attackKey(adv));
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

describe("once-per-turn damage", () => {
  const sneak = newOncePerTurn({ num_dice: 3 });

  it("needs at least one eligible attack", () => {
    expect(roundProblem({ attacks: [greatsword], once_per_turn: null })).toBeNull();
    expect(roundProblem({ attacks: [greatsword], once_per_turn: sneak })).toBe(
      "Mark at least one attack as eligible for Sneak Attack.",
    );
    expect(
      roundProblem({
        attacks: [greatsword, { ...handaxe, once_per_turn_eligible: true }],
        once_per_turn: sneak,
      }),
    ).toBeNull();
  });

  it("doesn't split groups by eligibility -- the rider has its own column", () => {
    expect(attackKey({ ...greatsword, once_per_turn_eligible: true })).toBe(attackKey(greatsword));
  });

  it("describes the rider and lists eligible attacks once each", () => {
    expect(describeOncePerTurn(sneak)).toBe("3d6");
    expect(describeOncePerTurn(newOncePerTurn({ num_dice: 2, die_sides: 8, modifier: 2 }))).toBe("2d8+2");
    const eligible = { ...handaxe, once_per_turn_eligible: true };
    expect(eligibleAttackNames([greatsword, eligible, eligible])).toEqual(["Handaxe"]);
  });
});

describe("step 12 options in descriptions", () => {
  it("mentions extra crit dice, rerolls and 3d20 advantage", () => {
    expect(
      describeAttack({
        ...greatsword,
        extra_crit_dice: 1,
        reroll_at_or_below: 2,
        advantage: true,
        super_advantage: true,
      }),
    ).toBe("+8, 2d6+5, +1 crit die, reroll ≤2, adv (3d20)");
    expect(describeAttack({ ...greatsword, crit_range: 19, extra_crit_dice: 2 })).toBe(
      "+8, 2d6+5, crit 19–20, +2 crit dice",
    );
    // 3d20 doesn't apply while advantage is cancelled.
    expect(
      describeAttack({ ...greatsword, advantage: true, disadvantage: true, super_advantage: true }),
    ).toBe("+8, 2d6+5");
  });
});
