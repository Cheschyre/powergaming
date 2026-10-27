import { useId, type ReactNode } from "react";

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}

/**
 * A labelled dropdown. The label points at the select by id rather than
 * wrapping it: a wrapping label would pull the selected option's text into
 * the accessible name ("Class Fighter" instead of "Class").
 */
export default function SelectField({ label, value, onChange, children }: SelectFieldProps) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </div>
  );
}
