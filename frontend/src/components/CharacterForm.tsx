import { useState, type FormEvent } from "react";
import {
  canDualWield,
  CLASS_LABELS,
  defaultProficiency,
  FIGHTING_STYLE_LABELS,
  newCharacter,
  srdChoice,
  weaponProfile,
  type WeaponTable,
} from "../characters";
import type {
  CharacterClass,
  CharacterSheet,
  FightingStyle,
  WeaponChoice,
} from "../types";
import CheckboxField from "./CheckboxField";
import NumberField from "./NumberField";
import SelectField from "./SelectField";
import WeaponPicker from "./WeaponPicker";

interface CharacterFormProps {
  weapons: WeaponTable;
  /** A saved character's sheet when editing; omitted for a new one. */
  initial?: CharacterSheet;
  submitLabel: string;
  onSubmit: (sheet: CharacterSheet) => Promise<void>;
  onCancel?: () => void;
  resetOnSuccess?: boolean;
}

/**
 * The character sheet: only what changes attack numbers (2014 rules,
 * Fighter or Rogue). Options that don't apply are hidden or cleared as you
 * go, so what's saved always passes the server's rules.
 */
export default function CharacterForm({
  weapons,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  resetOnSuccess = false,
}: CharacterFormProps) {
  const [sheet, setSheet] = useState<CharacterSheet>(
    () => initial ?? newCharacter(),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const main = weaponProfile(sheet.main_hand, weapons);
  const offHand = sheet.off_hand ?? null;
  const fighter = sheet.character_class === "fighter";
  const canUseOffHand = canDualWield(main) && !sheet.two_handed_grip;
  const canUseTwoHands = !!main?.versatile_die_sides && !offHand;

  function update(changes: Partial<CharacterSheet>) {
    setSheet((prev) => ({ ...prev, ...changes }));
  }

  function withProficiency(
    cls: CharacterClass,
    choice: WeaponChoice,
  ): WeaponChoice {
    return { ...choice, proficient: defaultProficiency(cls, choice, weapons) };
  }

  function setClass(cls: CharacterClass) {
    update({
      character_class: cls,
      // Fighting styles and Champion are Fighter-only in this version.
      fighting_style: cls === "fighter" ? sheet.fighting_style : "none",
      subclass: cls === "fighter" ? sheet.subclass : "none",
      main_hand: withProficiency(cls, sheet.main_hand),
      off_hand: offHand && withProficiency(cls, offHand),
    });
  }

  function setMainHand(choice: WeaponChoice) {
    const weapon = weaponProfile(choice, weapons);
    update({
      main_hand: choice,
      two_handed_grip: sheet.two_handed_grip && !!weapon?.versatile_die_sides,
      off_hand: canDualWield(weapon) ? offHand : null,
    });
  }

  function toggleOffHand(on: boolean) {
    update({
      off_hand: on
        ? withProficiency(sheet.character_class, srdChoice("dagger"))
        : null,
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSubmit(sheet);
      if (resetOnSuccess) setSheet(newCharacter());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save character.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel-form character-form">
      <div className="field-grid">
        <label className="field">
          <span>Character name</span>
          <input
            value={sheet.name}
            maxLength={100}
            onChange={(e) => update({ name: e.target.value })}
          />
        </label>
        <SelectField
          label="Class"
          value={sheet.character_class}
          onChange={(v) => setClass(v as CharacterClass)}
        >
          {Object.entries(CLASS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <NumberField
          label="Level"
          value={sheet.level}
          onChange={(v) => update({ level: v })}
          min={1}
          max={20}
        />
        <NumberField
          label="Strength"
          value={sheet.strength}
          onChange={(v) => update({ strength: v })}
          min={1}
          max={30}
        />
        <NumberField
          label="Dexterity"
          value={sheet.dexterity}
          onChange={(v) => update({ dexterity: v })}
          min={1}
          max={30}
        />
      </div>

      {fighter ? (
        <div className="field-grid">
          <SelectField
            label="Fighting style"
            value={sheet.fighting_style}
            onChange={(v) => update({ fighting_style: v as FightingStyle })}
          >
            {Object.entries(FIGHTING_STYLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Subclass"
            value={sheet.subclass}
            onChange={(v) =>
              update({ subclass: v as CharacterSheet["subclass"] })
            }
          >
            <option value="none">Other / none</option>
            <option value="champion">
              Champion (crits on 19–20 from level 3, 18–20 from 15)
            </option>
          </SelectField>
        </div>
      ) : (
        <div className="field-grid">
          <CheckboxField
            label="Sneak Attack can trigger (advantage, or an ally next to the target)"
            checked={sheet.sneak_attack_can_trigger}
            onChange={(v) => update({ sneak_attack_can_trigger: v })}
          />
        </div>
      )}

      <WeaponPicker
        label="Main hand"
        choice={sheet.main_hand}
        onChange={setMainHand}
        weapons={weapons}
        characterClass={sheet.character_class}
      />
      <div className="field-grid">
        {canUseTwoHands && (
          <CheckboxField
            label="Wield in two hands (versatile)"
            checked={sheet.two_handed_grip}
            onChange={(v) => update({ two_handed_grip: v })}
          />
        )}
        {(canUseOffHand || offHand) && (
          <CheckboxField
            label="Off-hand weapon (two-weapon fighting)"
            checked={offHand !== null}
            onChange={toggleOffHand}
          />
        )}
      </div>
      {offHand && (
        <WeaponPicker
          label="Off hand"
          choice={offHand}
          onChange={(choice) => update({ off_hand: choice })}
          weapons={weapons}
          characterClass={sheet.character_class}
          allow={canDualWield}
        />
      )}

      <div className="field-grid">
        <NumberField
          label="Other to-hit bonus"
          value={sheet.other_to_hit}
          onChange={(v) => update({ other_to_hit: v })}
        />
        <NumberField
          label="Other damage bonus"
          value={sheet.other_damage}
          onChange={(v) => update({ other_damage: v })}
        />
      </div>

      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="submit" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            className="secondary"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
