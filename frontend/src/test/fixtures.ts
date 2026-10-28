// Small factories for API objects used across tests.
import { newAttack } from "../attacks";
import type {
  ACResult,
  AttackEntry,
  AttackResult,
  Build,
  Character,
  SrdWeapon,
} from "../types";

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

export function attackResult(
  overrides: Partial<AttackResult> = {},
): AttackResult {
  return { hit_chance: 0.7, crit_chance: 0.05, had: 8.75, ...overrides };
}

/** A round result; `attacks` defaults to n copies of one attack result. */
export function acResult(overrides: Partial<ACResult> = {}, n = 1): ACResult {
  const attacks =
    overrides.attacks ?? Array.from({ length: n }, () => attackResult());
  return {
    ac: 15,
    attacks,
    once_per_turn: null,
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
    once_per_turn: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

// A slice of the SRD weapons table, as GET /api/srd/weapons returns it.
function srd(
  key: string,
  name: string,
  category: "simple" | "martial",
  num_dice: number,
  die_sides: number,
  props: Partial<SrdWeapon> = {},
): SrdWeapon {
  return {
    key,
    name,
    category,
    num_dice,
    die_sides,
    versatile_die_sides: null,
    finesse: false,
    light: false,
    heavy: false,
    two_handed: false,
    ranged: false,
    ...props,
  };
}

export const srdWeapons: SrdWeapon[] = [
  srd("dagger", "Dagger", "simple", 1, 4, { finesse: true, light: true }),
  srd("mace", "Mace", "simple", 1, 6),
  srd("greatsword", "Greatsword", "martial", 2, 6, {
    heavy: true,
    two_handed: true,
  }),
  srd("longsword", "Longsword", "martial", 1, 8, { versatile_die_sides: 10 }),
  srd("rapier", "Rapier", "martial", 1, 8, { finesse: true }),
  srd("scimitar", "Scimitar", "martial", 1, 6, { finesse: true, light: true }),
  srd("shortsword", "Shortsword", "martial", 1, 6, {
    finesse: true,
    light: true,
  }),
  srd("hand_crossbow", "Hand crossbow", "martial", 1, 6, {
    ranged: true,
    light: true,
  }),
  srd("longbow", "Longbow", "martial", 1, 8, {
    ranged: true,
    heavy: true,
    two_handed: true,
  }),
];

export function character(overrides: Partial<Character> = {}): Character {
  return {
    id: 1,
    name: "Vex",
    character_class: "rogue",
    level: 5,
    strength: 10,
    dexterity: 16,
    main_hand: {
      srd_weapon: "shortsword",
      custom: null,
      magic_bonus: 0,
      proficient: true,
    },
    off_hand: {
      srd_weapon: "dagger",
      custom: null,
      magic_bonus: 0,
      proficient: true,
    },
    two_handed_grip: false,
    fighting_style: "none",
    subclass: "none",
    sneak_attack_can_trigger: true,
    other_to_hit: 0,
    other_damage: 0,
    created_at: "2026-10-27T00:00:00Z",
    updated_at: "2026-10-27T00:00:00Z",
    ...overrides,
  };
}
