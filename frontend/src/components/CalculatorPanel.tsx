import { useState, type FormEvent } from "react";
import { calculate } from "../api";
import type { ACResult } from "../types";
import CheckboxField from "./CheckboxField";
import NumberField from "./NumberField";
import ResultsTable from "./ResultsTable";

function parseAcList(text: string): number[] {
  return text
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => Number(part));
}

export default function CalculatorPanel() {
  const [attackBonus, setAttackBonus] = useState(5);
  const [acListText, setAcListText] = useState("12, 15, 18");
  const [numDice, setNumDice] = useState(1);
  const [dieSides, setDieSides] = useState(8);
  const [modifier, setModifier] = useState(3);
  const [numAttacks, setNumAttacks] = useState(1);
  const [advantage, setAdvantage] = useState(false);
  const [disadvantage, setDisadvantage] = useState(false);
  const [critRange, setCritRange] = useState(20);
  const [powerAttack, setPowerAttack] = useState(false);
  const [powerAttackBonus, setPowerAttackBonus] = useState(10);
  const [powerAttackPenalty, setPowerAttackPenalty] = useState(-5);

  const [results, setResults] = useState<ACResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await calculate({
        attack_bonus: attackBonus,
        ac_list: parseAcList(acListText),
        num_dice: numDice,
        die_sides: dieSides,
        modifier,
        num_attacks: numAttacks,
        advantage,
        disadvantage,
        crit_range: critRange,
        power_attack: powerAttack,
        power_attack_bonus: powerAttackBonus,
        power_attack_penalty: powerAttackPenalty,
      });
      setResults(response.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <form onSubmit={handleSubmit} className="panel-form">
        <div className="field-grid">
          <NumberField label="Attack bonus" value={attackBonus} onChange={setAttackBonus} />
          <label className="field">
            <span>Target AC(s), comma-separated</span>
            <input value={acListText} onChange={(e) => setAcListText(e.target.value)} />
          </label>
          <NumberField label="Number of dice" value={numDice} onChange={setNumDice} min={1} />
          <NumberField label="Die sides" value={dieSides} onChange={setDieSides} min={2} />
          <NumberField label="Damage modifier" value={modifier} onChange={setModifier} />
          <NumberField
            label="Attacks per round"
            value={numAttacks}
            onChange={setNumAttacks}
            min={1}
          />
          <NumberField
            label="Crit range (lowest roll that crits)"
            value={critRange}
            onChange={setCritRange}
            min={2}
            max={20}
          />
        </div>

        <div className="field-grid">
          <CheckboxField label="Advantage" checked={advantage} onChange={setAdvantage} />
          <CheckboxField label="Disadvantage" checked={disadvantage} onChange={setDisadvantage} />
          <CheckboxField
            label="Power Attack (GWM/Sharpshooter)"
            checked={powerAttack}
            onChange={setPowerAttack}
          />
        </div>

        {powerAttack && (
          <div className="field-grid">
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
          </div>
        )}

        <button type="submit" disabled={loading}>
          {loading ? "Calculating…" : "Calculate"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {results && <ResultsTable results={results} />}
    </section>
  );
}
