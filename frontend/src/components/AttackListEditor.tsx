import { MAX_ATTACKS, newAttack } from "../attacks";
import type { AttackEntry } from "../types";
import CheckboxField from "./CheckboxField";
import NumberField from "./NumberField";

interface AttackListEditorProps {
  attacks: AttackEntry[];
  onChange: (attacks: AttackEntry[]) => void;
}

/**
 * Edits a round as a list of attacks. Extra Attack is just a duplicated row;
 * each row has its own power-attack toggle, so you can power-attack with one
 * swing and not another.
 */
export default function AttackListEditor({ attacks, onChange }: AttackListEditorProps) {
  const full = attacks.length >= MAX_ATTACKS;

  function update(index: number, changes: Partial<AttackEntry>) {
    onChange(attacks.map((a, i) => (i === index ? { ...a, ...changes } : a)));
  }

  function duplicate(index: number) {
    onChange([...attacks.slice(0, index + 1), { ...attacks[index] }, ...attacks.slice(index + 1)]);
  }

  function remove(index: number) {
    onChange(attacks.filter((_, i) => i !== index));
  }

  return (
    <div className="attack-list">
      {attacks.map((attack, i) => (
        <fieldset className="attack-row" key={i} aria-label={`Attack ${i + 1}`}>
          <div className="attack-row-header">
            <legend>Attack {i + 1}</legend>
            <div className="attack-row-actions">
              <button type="button" onClick={() => duplicate(i)} disabled={full}>
                Duplicate
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => remove(i)}
                disabled={attacks.length === 1}
              >
                Remove
              </button>
            </div>
          </div>
          <div className="field-grid">
            <label className="field">
              <span>Name</span>
              <input
                value={attack.name}
                maxLength={50}
                onChange={(e) => update(i, { name: e.target.value })}
              />
            </label>
            <NumberField
              label="Attack bonus"
              value={attack.attack_bonus}
              onChange={(v) => update(i, { attack_bonus: v })}
            />
            <NumberField
              label="Number of dice"
              value={attack.num_dice}
              onChange={(v) => update(i, { num_dice: v })}
              min={1}
            />
            <NumberField
              label="Die sides"
              value={attack.die_sides}
              onChange={(v) => update(i, { die_sides: v })}
              min={2}
            />
            <NumberField
              label="Damage modifier"
              value={attack.modifier}
              onChange={(v) => update(i, { modifier: v })}
            />
            <NumberField
              label="Crit range (lowest roll that crits)"
              value={attack.crit_range}
              onChange={(v) => update(i, { crit_range: v })}
              min={2}
              max={20}
            />
          </div>
          <div className="field-grid">
            <CheckboxField
              label="Advantage"
              checked={attack.advantage}
              onChange={(v) => update(i, { advantage: v })}
            />
            <CheckboxField
              label="Disadvantage"
              checked={attack.disadvantage}
              onChange={(v) => update(i, { disadvantage: v })}
            />
            <CheckboxField
              label="Power Attack (GWM/Sharpshooter)"
              checked={attack.power_attack}
              onChange={(v) => update(i, { power_attack: v })}
            />
          </div>
          {attack.power_attack && (
            <div className="field-grid">
              <NumberField
                label="Power attack bonus damage"
                value={attack.power_attack_bonus}
                onChange={(v) => update(i, { power_attack_bonus: v })}
              />
              <NumberField
                label="Power attack hit penalty"
                value={attack.power_attack_penalty}
                onChange={(v) => update(i, { power_attack_penalty: v })}
              />
            </div>
          )}
        </fieldset>
      ))}
      <button
        type="button"
        className="add-attack"
        onClick={() => onChange([...attacks, newAttack()])}
        disabled={full}
      >
        + Add attack
      </button>
    </div>
  );
}
