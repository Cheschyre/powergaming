import { useState, type FormEvent } from "react";
import { calculate } from "../api";
import { newAttack, parseAcList, roundProblem, type Round } from "../attacks";
import type { ACResult } from "../types";
import ResultsTable from "./ResultsTable";
import RoundEditor from "./RoundEditor";

interface CalculatedRound {
  results: ACResult[];
  /** The round the results were calculated for -- edits made afterwards
   * don't relabel a table that no longer matches them. */
  round: Round;
}

export default function CalculatorPanel() {
  const [acListText, setAcListText] = useState("12, 15, 18");
  const [round, setRound] = useState<Round>({ attacks: [newAttack()], once_per_turn: null });

  const [calculated, setCalculated] = useState<CalculatedRound | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const snapshot: Round = {
      attacks: round.attacks.map((a) => ({ ...a })),
      once_per_turn: round.once_per_turn && { ...round.once_per_turn },
    };
    try {
      const response = await calculate({ ac_list: parseAcList(acListText), ...snapshot });
      setCalculated({ results: response.results, round: snapshot });
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

        <RoundEditor round={round} onChange={setRound} />

        <button type="submit" disabled={loading || roundProblem(round) !== null}>
          {loading ? "Calculating…" : "Calculate"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {calculated && (
        <ResultsTable
          results={calculated.results}
          attacks={calculated.round.attacks}
          oncePerTurn={calculated.round.once_per_turn}
        />
      )}
    </section>
  );
}
