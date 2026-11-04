/**
 * Helpers for the character sheet (roadmap step 13): defaults for a new
 * character, weapon lookups and labels, and 2014 weapon proficiency so the
 * "proficient" box starts out right for the class.
 */
import type {
  AbilityIncreaseChoice,
  Character,
  CharacterClass,
  CharacterSheet,
  FightingStyle,
  PowerAttackBreakeven,
  SrdWeapon,
  WeaponChoice,
  WeaponProfile,
} from "./types";

export const CLASS_LABELS: Record<CharacterClass, string> = {
  fighter: "Fighter",
  rogue: "Rogue",
};

export const FIGHTING_STYLE_LABELS: Record<FightingStyle, string> = {
  none: "None",
  archery: "Archery (+2 to hit with ranged weapons)",
  dueling: "Dueling (+2 damage, one one-handed melee weapon)",
  great_weapon_fighting: "Great Weapon Fighting (reroll 1s and 2s, two hands)",
  two_weapon_fighting:
    "Two-Weapon Fighting (ability modifier on the off-hand attack)",
};

// 2014 Ability Score Improvement levels -- matches ASI_LEVELS in
// backend/app/schemas.py (the server validates them).
export const ASI_LEVELS: Record<CharacterClass, number[]> = {
  fighter: [4, 6, 8, 12, 14, 16, 19],
  rogue: [4, 8, 10, 12, 16, 19],
};

export const ASI_CHOICE_LABELS: Record<AbilityIncreaseChoice, string> = {
  strength_2: "+2 STR",
  dexterity_2: "+2 DEX",
  strength_dexterity: "+1 STR, +1 DEX",
  elven_accuracy: "Elven Accuracy (+1 DEX)",
  power_attack_feat: "Power attack feat",
  other_feat: "Other feat",
};

/** Feats the engine models -- each can only be taken once. */
export const MODELED_FEATS: AbilityIncreaseChoice[] = [
  "elven_accuracy",
  "power_attack_feat",
];

const FEAT_NAMES: Partial<Record<AbilityIncreaseChoice, string>> = {
  elven_accuracy: "Elven Accuracy",
  power_attack_feat: "Power attack feat",
};

const SCORE_INCREASES: Record<AbilityIncreaseChoice, [number, number]> = {
  strength_2: [2, 0],
  dexterity_2: [0, 2],
  strength_dexterity: [1, 1],
  elven_accuracy: [0, 1],
  power_attack_feat: [0, 0],
  other_feat: [0, 0],
};

// An ASI can't raise a score above 20; a score already above it (magic
// items) stays where it is.
function raise(score: number, amount: number): number {
  if (amount === 0 || score >= 20) return score;
  return Math.min(20, score + amount);
}

/**
 * STR and DEX at a level: starting scores plus the choices up to it. The
 * same rule as the server's (app/character.py) -- used to preview scores
 * while editing; saved characters also come with `current_scores`.
 */
export function scoresAtLevel(
  sheet: CharacterSheet,
  level: number,
): { strength: number; dexterity: number } {
  let { strength, dexterity } = sheet;
  const increases = [...(sheet.ability_increases ?? [])].sort(
    (a, b) => a.level - b.level,
  );
  for (const increase of increases) {
    if (increase.level > level) break;
    const [str, dex] = SCORE_INCREASES[increase.choice];
    strength = raise(strength, str);
    dexterity = raise(dexterity, dex);
  }
  return { strength, dexterity };
}

/** Modeled feats taken by the character's current level. */
export function featsTaken(sheet: CharacterSheet): string[] {
  return (sheet.ability_increases ?? [])
    .filter((i) => i.level <= sheet.level && FEAT_NAMES[i.choice])
    .sort((a, b) => a.level - b.level)
    .map((i) => FEAT_NAMES[i.choice]!);
}

// 2014 Rogue: simple weapons plus these martial ones. Fighters are
// proficient with everything.
const ROGUE_MARTIAL_WEAPONS = new Set([
  "hand_crossbow",
  "longsword",
  "rapier",
  "shortsword",
]);

export type WeaponTable = Map<string, SrdWeapon>;

export function weaponTable(weapons: SrdWeapon[]): WeaponTable {
  return new Map(weapons.map((w) => [w.key, w]));
}

export function weaponProfile(
  choice: WeaponChoice,
  weapons: WeaponTable,
): WeaponProfile | undefined {
  if (choice.custom) return choice.custom;
  return choice.srd_weapon ? weapons.get(choice.srd_weapon) : undefined;
}

/** Whether a class is proficient with a weapon (custom weapons: assume so). */
export function defaultProficiency(
  characterClass: CharacterClass,
  choice: WeaponChoice,
  weapons: WeaponTable,
): boolean {
  if (characterClass === "fighter" || choice.custom || !choice.srd_weapon)
    return true;
  const weapon = weapons.get(choice.srd_weapon);
  return (
    weapon?.category === "simple" ||
    ROGUE_MARTIAL_WEAPONS.has(choice.srd_weapon)
  );
}

/** Light melee weapons -- the only ones two-weapon fighting allows (2014). */
export function canDualWield(weapon: WeaponProfile | undefined): boolean {
  return !!weapon && weapon.light && !weapon.ranged;
}

export function srdChoice(key: string): WeaponChoice {
  return { srd_weapon: key, custom: null, magic_bonus: 0, proficient: true };
}

export function newCustomWeapon(): WeaponProfile {
  return {
    name: "Custom weapon",
    num_dice: 1,
    die_sides: 8,
    versatile_die_sides: null,
    finesse: false,
    light: false,
    heavy: false,
    two_handed: false,
    ranged: false,
  };
}

export function newCharacter(): CharacterSheet {
  return {
    name: "New character",
    character_class: "fighter",
    level: 1,
    strength: 16,
    dexterity: 14,
    main_hand: srdChoice("longsword"),
    off_hand: null,
    two_handed_grip: false,
    fighting_style: "none",
    subclass: "none",
    sneak_attack_can_trigger: true,
    other_to_hit: 0,
    other_damage: 0,
    ability_increases: [],
  };
}

/** A saved character back to an editable sheet (drops id, timestamps and
 * the server-computed current scores). */
export function toSheet(character: Character): CharacterSheet {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, created_at, updated_at, current_scores, ...sheet } = character;
  return sheet;
}

/** e.g. "+1 Longsword" */
export function weaponLabel(
  choice: WeaponChoice,
  weapons: WeaponTable,
): string {
  const name = weaponProfile(choice, weapons)?.name ?? "Unknown weapon";
  return choice.magic_bonus ? `+${choice.magic_bonus} ${name}` : name;
}

/** e.g. "Level 5 Fighter (Champion)" */
export function describeCharacter(c: CharacterSheet): string {
  const subclass =
    c.character_class === "fighter" && c.subclass === "champion"
      ? " (Champion)"
      : "";
  return `Level ${c.level} ${CLASS_LABELS[c.character_class]}${subclass}`;
}

/** e.g. "+1 Longsword (two hands)", "Shortsword + Dagger" */
export function describeWeapons(
  c: CharacterSheet,
  weapons: WeaponTable,
): string {
  const main = weaponLabel(c.main_hand, weapons);
  if (c.off_hand) return `${main} + ${weaponLabel(c.off_hand, weapons)}`;
  return c.two_handed_grip ? `${main} (two hands)` : main;
}

/** The round's power-attack breakeven as a sentence (see
 * PowerAttackBreakeven in backend/app/schemas.py). */
export function describeBreakeven(b: PowerAttackBreakeven): string {
  switch (b.status) {
    case "pays_off_up_to":
      return `Power attack pays off against AC ${b.ac} or lower.`;
    case "always":
      return "Power attack pays off at every AC (1–30).";
    case "never":
      return "Power attack never pays off: the round does more without it, even at AC 1.";
    case "not_applicable":
      return "Power attack doesn't apply: no heavy or ranged weapon, or the feat isn't taken yet at this level.";
  }
}

/** The same, short, for a table cell: "AC 17", "Every AC", "Never", "–". */
export function breakevenCell(b: PowerAttackBreakeven): string {
  switch (b.status) {
    case "pays_off_up_to":
      return `AC ${b.ac}`;
    case "always":
      return "Every AC";
    case "never":
      return "Never";
    case "not_applicable":
      return "–";
  }
}
