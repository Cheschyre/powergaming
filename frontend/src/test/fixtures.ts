// Small factories for API objects used across tests.
import { newAttack } from "../attacks";
import type { ACResult, AttackEntry, AttackResult, Build } from "../types";

export const greatsword: AttackEntry = newAttack({
  name: "Greatsword",
  attack_bonus: 8,
  num_dice: 2,
  die_sides: 6,
  modifier: 5,
});

export const handaxe: AttackEntry = newAttack({
  name: "Handaxe",
  attack_bonus: 8,
  num_dice: 1,
  die_sides: 6,
  modifier: 0,
});

export function attackResult(overrides: Partial<AttackResult> = {}): AttackResult {
  return { hit_chance: 0.7, crit_chance: 0.05, had: 8.75, ...overrides };
}

/** A round result; `attacks` defaults to n copies of one attack result. */
export function acResult(overrides: Partial<ACResult> = {}, n = 1): ACResult {
  const attacks = overrides.attacks ?? Array.from({ length: n }, () => attackResult());
  return {
    ac: 15,
    attacks,
    total_had: attacks.reduce((sum, a) => sum + a.had, 0),
    total_had_without_power_attack: null,
    ...overrides,
  };
}

export function build(overrides: Partial<Build> = {}): Build {
  return {
    id: 1,
    name: "Greatsword fighter",
    attacks: [greatsword, greatsword],
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}
