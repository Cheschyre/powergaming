/**
 * Helpers for a round's list of attacks: sensible defaults for new rows,
 * grouping identical attacks for display ("Greatsword ×2"), and short
 * human-readable descriptions.
 */
import type { AttackEntry } from "./types";

export const MAX_ATTACKS = 20; // matches MAX_ATTACKS_PER_ROUND in backend/app/schemas.py

export function newAttack(overrides: Partial<AttackEntry> = {}): AttackEntry {
  return {
    name: "Attack",
    attack_bonus: 5,
    num_dice: 1,
    die_sides: 8,
    modifier: 3,
    crit_range: 20,
    advantage: false,
    disadvantage: false,
    power_attack: false,
    // Pre-filled with the usual GWM/Sharpshooter trade; only used once the
    // attack's power attack is switched on.
    power_attack_bonus: 10,
    power_attack_penalty: -5,
    ...overrides,
  };
}

/**
 * Identity for grouping: two attacks are "the same" if every setting that
 * affects the math (and the name) matches. Power-attack numbers only count
 * while power attack is on, so a hidden leftover value never splits a group.
 */
export function attackKey(a: AttackEntry): string {
  return JSON.stringify([
    a.name,
    a.attack_bonus,
    a.num_dice,
    a.die_sides,
    a.modifier,
    a.crit_range,
    a.advantage,
    a.disadvantage,
    a.power_attack,
    a.power_attack ? a.power_attack_bonus : null,
    a.power_attack ? a.power_attack_penalty : null,
  ]);
}

export interface AttackGroup {
  attack: AttackEntry;
  /** Positions of this group's attacks in the round, in order. */
  indices: number[];
}

/** Groups identical attacks, in order of first appearance. */
export function groupAttacks(attacks: AttackEntry[]): AttackGroup[] {
  const groups = new Map<string, AttackGroup>();
  attacks.forEach((attack, i) => {
    const key = attackKey(attack);
    const group = groups.get(key);
    if (group) group.indices.push(i);
    else groups.set(key, { attack, indices: [i] });
  });
  return [...groups.values()];
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/** e.g. "+8, 2d6+5, crit 19–20, adv, PA +10/−5" */
export function describeAttack(a: AttackEntry): string {
  const parts = [
    signed(a.attack_bonus),
    `${a.num_dice}d${a.die_sides}${a.modifier ? signed(a.modifier) : ""}`,
  ];
  if (a.crit_range < 20) parts.push(`crit ${a.crit_range}–20`);
  if (a.advantage && !a.disadvantage) parts.push("adv");
  if (a.disadvantage && !a.advantage) parts.push("disadv");
  if (a.power_attack) {
    parts.push(`PA ${signed(a.power_attack_bonus)}/${signed(a.power_attack_penalty).replace("-", "−")}`);
  }
  return parts.join(", ");
}

/** Column/summary label for a group, e.g. "Greatsword (PA) ×2". */
export function groupLabel(group: AttackGroup): string {
  const pa = group.attack.power_attack ? " (PA)" : "";
  const count = group.indices.length > 1 ? ` ×${group.indices.length}` : "";
  return `${group.attack.name}${pa}${count}`;
}

/** "12, 15,,18 " -> [12, 15, 18]; blanks are ignored, the API validates range. */
export function parseAcList(text: string): number[] {
  return text
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map(Number);
}
