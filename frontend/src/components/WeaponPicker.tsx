import {
  defaultProficiency,
  newCustomWeapon,
  type WeaponTable,
} from "../characters";
import type {
  CharacterClass,
  SrdWeapon,
  WeaponChoice,
  WeaponProfile,
} from "../types";
import CheckboxField from "./CheckboxField";
import NumberField from "./NumberField";
import SelectField from "./SelectField";

const CUSTOM = "__custom";

const GROUPS: { label: string; match: (w: SrdWeapon) => boolean }[] = [
  { label: "Simple melee", match: (w) => w.category === "simple" && !w.ranged },
  { label: "Simple ranged", match: (w) => w.category === "simple" && w.ranged },
  {
    label: "Martial melee",
    match: (w) => w.category === "martial" && !w.ranged,
  },
  {
    label: "Martial ranged",
    match: (w) => w.category === "martial" && w.ranged,
  },
];

interface WeaponPickerProps {
  label: string;
  choice: WeaponChoice;
  onChange: (choice: WeaponChoice) => void;
  weapons: WeaponTable;
  characterClass: CharacterClass;
  /** Limit the SRD list (e.g. light melee weapons for the off hand). */
  allow?: (weapon: SrdWeapon) => boolean;
}

/** An SRD weapon or a custom one, plus its magic bonus and proficiency. */
export default function WeaponPicker({
  label,
  choice,
  onChange,
  weapons,
  characterClass,
  allow = () => true,
}: WeaponPickerProps) {
  const custom = choice.custom ?? null;
  const allowed = [...weapons.values()].filter(allow);

  function pick(value: string) {
    const next: WeaponChoice =
      value === CUSTOM
        ? { ...choice, srd_weapon: null, custom: newCustomWeapon() }
        : { ...choice, srd_weapon: value, custom: null };
    onChange({
      ...next,
      proficient: defaultProficiency(characterClass, next, weapons),
    });
  }

  function updateCustom(changes: Partial<WeaponProfile>) {
    if (custom) onChange({ ...choice, custom: { ...custom, ...changes } });
  }

  return (
    <fieldset className="weapon-picker" aria-label={label}>
      <legend>{label}</legend>
      <div className="field-grid">
        <SelectField
          label="Weapon"
          value={custom ? CUSTOM : (choice.srd_weapon ?? "")}
          onChange={pick}
        >
          {GROUPS.map((group) => {
            const options = allowed.filter(group.match);
            return (
              options.length > 0 && (
                <optgroup key={group.label} label={group.label}>
                  {options.map((w) => (
                    <option key={w.key} value={w.key}>
                      {w.name} ({w.num_dice}d{w.die_sides})
                    </option>
                  ))}
                </optgroup>
              )
            );
          })}
          <option value={CUSTOM}>Custom…</option>
        </SelectField>
        <SelectField
          label="Magic bonus"
          value={String(choice.magic_bonus)}
          onChange={(v) => onChange({ ...choice, magic_bonus: Number(v) })}
        >
          <option value="0">None</option>
          <option value="1">+1</option>
          <option value="2">+2</option>
          <option value="3">+3</option>
        </SelectField>
        <CheckboxField
          label="Proficient"
          checked={choice.proficient}
          onChange={(v) => onChange({ ...choice, proficient: v })}
        />
      </div>
      {custom && (
        <>
          <div className="field-grid">
            <label className="field">
              <span>Weapon name</span>
              <input
                value={custom.name}
                maxLength={50}
                onChange={(e) => updateCustom({ name: e.target.value })}
              />
            </label>
            <NumberField
              label="Number of dice"
              value={custom.num_dice}
              onChange={(v) => updateCustom({ num_dice: v })}
              min={1}
              max={10}
            />
            <NumberField
              label="Die sides"
              value={custom.die_sides}
              onChange={(v) => updateCustom({ die_sides: v })}
              min={2}
              max={20}
            />
            <NumberField
              label="Two-handed die sides (versatile, 0 = no)"
              value={custom.versatile_die_sides ?? 0}
              onChange={(v) =>
                updateCustom({ versatile_die_sides: v > 0 ? v : null })
              }
              min={0}
              max={20}
            />
          </div>
          <div className="field-grid">
            {(
              ["finesse", "light", "heavy", "two_handed", "ranged"] as const
            ).map((prop) => (
              <CheckboxField
                key={prop}
                label={
                  prop === "two_handed"
                    ? "Two-handed"
                    : prop[0].toUpperCase() + prop.slice(1)
                }
                checked={custom[prop] ?? false}
                onChange={(v) => updateCustom({ [prop]: v })}
              />
            ))}
          </div>
        </>
      )}
    </fieldset>
  );
}
