import { useState, type FormEvent } from "react";
import { newAttack, roundProblem, type Round } from "../attacks";
import type { BuildCreate } from "../types";
import RoundEditor from "./RoundEditor";

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

const BLANK_NAME = "New Build";

function blankRound(): Round {
  return { attacks: [newAttack()], once_per_turn: null };
}

/** Name + round (attack rows, once-per-turn damage), shared by "Save a new build" and editing a saved one. */
export default function BuildForm({
  initial,
  submitLabel,
  busyLabel,
  onSubmit,
  onCancel,
  resetOnSuccess = false,
}: BuildFormProps) {
  const [name, setName] = useState(initial?.name ?? BLANK_NAME);
  // Copies, so editing never mutates the saved build shown elsewhere.
  const [round, setRound] = useState<Round>(() =>
    initial
      ? {
          attacks: initial.attacks.map((a) => ({ ...a })),
          once_per_turn: initial.once_per_turn ? { ...initial.once_per_turn } : null,
        }
      : blankRound(),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSubmit({ name, ...round });
      if (resetOnSuccess) {
        setName(BLANK_NAME);
        setRound(blankRound());
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
      <RoundEditor round={round} onChange={setRound} />
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="submit" disabled={busy || roundProblem(round) !== null}>
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
