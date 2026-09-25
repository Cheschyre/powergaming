import { useState, type FormEvent } from "react";
import { breakeven } from "../api";
import type { BreakevenRow } from "../types";
import CheckboxField from "./CheckboxField";
import NumberField from "./NumberField";

export default function BreakevenPanel() {
  const [attackBonus, setAttackBonus] = useState(8);
  const [numDice, setNumDice] = useState(1);
  const [dieSides, setDieSides] = useState(12);
  const [modifier, setModifier] = useState(3);
  const [powerAttackBonus, setPowerAttackBonus] = useState(10);
  const [powerAttackPenalty, setPowerAttackPenalty] = useState(-5);
  const [advantage, setAdvantage] = useState(false);
  const [disadvantage, setDisadvantage] = useState(false);
  const [critRange, setCritRange] = useState(20);
  const [acMin, setAcMin] = useState(1);
  const [acMax, setAcMax] = useState(30);

  const [rows, setRows] = useState<BreakevenRow[] | null>(null);
  const [crossovers, setCrossovers] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await breakeven({
        attack_bonus: attackBonus,
        num_dice: numDice,
        die_sides: dieSides,
        modifier,
        power_attack_bonus: powerAttackBonus,
        power_attack_penalty: powerAttackPenalty,
        advantage,
        disadvantage,
        crit_range: critRange,
        ac_min: acMin,
        ac_max: acMax,
      });
      setRows(response.rows);
      setCrossovers(response.crossovers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setRows(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <form onSubmit={handleSubmit} className="panel-form">
        <div className="field-grid">
          <NumberField label="Attack bonus" value={attackBonus} onChange={setAttackBonus} />
          <NumberField label="Number of dice" value={numDice} onChange={setNumDice} min={1} />
          <NumberField label="Die sides" value={dieSides} onChange={setDieSides} min={2} />
          <NumberField label="Damage modifier" value={modifier} onChange={setModifier} />
          <NumberField
            label="Power attack bonus damage"
            value={powerAttackBonus}
            onChange={setPowerAttackBonus}
          />
          <NumberField
            label="Power attack hit penalty"
            value={powerAttackPenalty}
            onChange={setPowerAttackPenalty}
          />
          <NumberField
            label="Crit range"
            value={critRange}
            onChange={setCritRange}
            min={2}
            max={20}
          />
          <NumberField label="AC range: min" value={acMin} onChange={setAcMin} min={1} max={30} />
          <NumberField label="AC range: max" value={acMax} onChange={setAcMax} min={1} max={30} />
        </div>
        <div className="field-grid">
          <CheckboxField label="Advantage" checked={advantage} onChange={setAdvantage} />
          <CheckboxField label="Disadvantage" checked={disadvantage} onChange={setDisadvantage} />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? "Calculating…" : "Find Breakeven"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {rows && (
        <>
          <p>
            {crossovers.length > 0
              ? `Crossover AC(s): ${crossovers.join(", ")}`
              : "No crossover in this AC range – one option is better throughout."}
          </p>
          <table className="results-table">
            <thead>
              <tr>
                <th>AC</th>
                <th>Normal HAD</th>
                <th>Power HAD</th>
                <th>Better</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const better =
                  row.power_had > row.normal_had
                    ? "Power"
                    : row.normal_had > row.power_had
                      ? "Normal"
                      : "Tied";
                const isCrossover = crossovers.includes(row.ac);
                return (
                  <tr key={row.ac} className={isCrossover ? "crossover-row" : undefined}>
                    <td>{row.ac}</td>
                    <td>{row.normal_had.toFixed(2)}</td>
                    <td>{row.power_had.toFixed(2)}</td>
                    <td>{better}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
