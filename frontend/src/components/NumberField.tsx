import { useState } from "react";

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

/**
 * A number input that can be emptied while typing. The text is kept here
 * and only complete numbers reach `onChange` -- converting every keystroke
 * would turn a cleared field into 0. Leaving the field empty puts the last
 * number back, and `required` stops a form submitting while it's empty.
 */
export default function NumberField({ label, value, onChange, min, max }: NumberFieldProps) {
  const [text, setText] = useState(String(value));
  // The value the text was last synced with. When the parent changes the
  // value itself (a form reset, a class change), show the new one.
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setText(String(value));
  }

  function handleChange(raw: string) {
    setText(raw);
    // A number input reports "" for empty and for unfinished text like "-".
    if (raw.trim() === "") return;
    const next = Number(raw);
    if (Number.isNaN(next)) return;
    setSynced(next);
    onChange(next);
  }

  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={text}
        min={min}
        max={max}
        required
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => {
          if (text.trim() === "") setText(String(value));
        }}
      />
    </label>
  );
}
