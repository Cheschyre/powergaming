/**
 * Helpers for the character sheet (roadmap step 13): defaults for a new
 * character, weapon lookups and labels, and 2014 weapon proficiency so the
 * "proficient" box starts out right for the class.
 */
import type {
  Character,
  CharacterClass,
  CharacterSheet,
  FightingStyle,
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
  };
}

/** A saved character back to an editable sheet (drops id/timestamps). */
export function toSheet(character: Character): CharacterSheet {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, created_at, updated_at, ...sheet } = character;
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
