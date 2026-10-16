import { useState, type FormEvent } from "react";
import { newAttack } from "../attacks";
import type { AttackEntry, BuildCreate } from "../types";
import AttackListEditor from "./AttackListEditor";

interface BuildFormProps {
  /** Starting values -- a saved build when editing, omitted for a new one. */
  initial?: BuildCreate;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (build: BuildCreate) => Promise<void>;
  onCancel?: () => void;
  /** Clear the form after a successful submit (used by "Save a new build"). */
  resetOnSuccess?: boolean;
}

const BLANK: BuildCreate = { name: "New Build", attacks: [newAttack()] };

/** Name + attack rows, shared by "Save a new build" and editing a saved one. */
export default function BuildForm({
  initial = BLANK,
  submitLabel,
  busyLabel,
  onSubmit,
  onCancel,
  resetOnSuccess = false,
}: BuildFormProps) {
  const [name, setName] = useState(initial.name);
  // Copies, so editing never mutates the saved build shown elsewhere.
  const [attacks, setAttacks] = useState<AttackEntry[]>(() =>
    initial.attacks.map((a) => ({ ...a })),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSubmit({ name, attacks });
      if (resetOnSuccess) {
        setName(BLANK.name);
        setAttacks([newAttack()]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save build.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel-form">
      <div className="field-grid">
        <label className="field">
          <span>Build name</span>
          <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        </label>
      </div>
      <AttackListEditor attacks={attacks} onChange={setAttacks} />
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="submit" disabled={busy}>
          {busy ? busyLabel : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
