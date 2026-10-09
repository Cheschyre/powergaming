// Small factories for API response objects used across tests.
import type { ACResult, Build } from "../types";

export function acResult(overrides: Partial<ACResult> = {}): ACResult {
  return {
    ac: 15,
    hit_chance: 0.55,
    crit_chance: 0.05,
    had: 4.4,
    total_had_per_round: 8.8,
    power_hit_chance: null,
    power_crit_chance: null,
    power_had: null,
    power_total_had_per_round: null,
    ...overrides,
  };
}

export function build(overrides: Partial<Build> = {}): Build {
  return {
    id: 1,
    name: "Greatsword fighter",
    attack_bonus: 7,
    num_dice: 2,
    die_sides: 6,
    modifier: 4,
    num_attacks: 2,
    advantage: false,
    disadvantage: false,
    crit_range: 20,
    power_attack: true,
    power_attack_bonus: 10,
    power_attack_penalty: -5,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}
