import type { OncePerTurn } from "../types";
import NumberField from "./NumberField";

interface OncePerTurnEditorProps {
  value: OncePerTurn;
  onChange: (value: OncePerTurn) => void;
}

/** Name and dice for the round's once-per-turn damage. */
export default function OncePerTurnEditor({ value, onChange }: OncePerTurnEditorProps) {
  function update(changes: Partial<OncePerTurn>) {
    onChange({ ...value, ...changes });
  }

  return (
    <div className="field-grid">
      <label className="field">
        <span>Name</span>
        <input value={value.name} maxLength={50} onChange={(e) => update({ name: e.target.value })} />
      </label>
      <NumberField
        label="Number of dice"
        value={value.num_dice}
        onChange={(v) => update({ num_dice: v })}
        min={1}
      />
      <NumberField
        label="Die sides"
        value={value.die_sides}
        onChange={(v) => update({ die_sides: v })}
        min={2}
      />
      <NumberField
        label="Flat bonus"
        value={value.modifier}
        onChange={(v) => update({ modifier: v })}
      />
    </div>
  );
}
