import { useState, type FormEvent } from "react";
import { calculate } from "../api";
import { newAttack, parseAcList } from "../attacks";
import type { ACResult, AttackEntry } from "../types";
import AttackListEditor from "./AttackListEditor";
import ResultsTable from "./ResultsTable";

interface CalculatedRound {
  results: ACResult[];
  /** The attacks the results were calculated for -- edits made afterwards
   * don't relabel a table that no longer matches them. */
  attacks: AttackEntry[];
}

export default function CalculatorPanel() {
  const [acListText, setAcListText] = useState("12, 15, 18");
  const [attacks, setAttacks] = useState<AttackEntry[]>([newAttack()]);

  const [calculated, setCalculated] = useState<CalculatedRound | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const snapshot = attacks.map((a) => ({ ...a }));
    try {
      const response = await calculate({ ac_list: parseAcList(acListText), attacks: snapshot });
      setCalculated({ results: response.results, attacks: snapshot });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setCalculated(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <form onSubmit={handleSubmit} className="panel-form">
        <div className="field-grid">
          <label className="field">
            <span>Target AC(s), comma-separated</span>
            <input value={acListText} onChange={(e) => setAcListText(e.target.value)} />
          </label>
        </div>

        <AttackListEditor attacks={attacks} onChange={setAttacks} />

        <button type="submit" disabled={loading}>
          {loading ? "Calculating…" : "Calculate"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {calculated && <ResultsTable results={calculated.results} attacks={calculated.attacks} />}
    </section>
  );
}
