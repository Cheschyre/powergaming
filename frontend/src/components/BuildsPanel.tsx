import { useEffect, useState, type FormEvent } from "react";
import { calculateForBuild, createBuild, deleteBuild, listBuilds } from "../api";
import type { ACResult, Build } from "../types";
import CheckboxField from "./CheckboxField";
import NumberField from "./NumberField";
import ResultsTable from "./ResultsTable";

export default function BuildsPanel() {
  const [builds, setBuilds] = useState<Build[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("New Build");
  const [attackBonus, setAttackBonus] = useState(5);
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
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [runAcText, setRunAcText] = useState<Record<number, string>>({});
  const [runResults, setRunResults] = useState<Record<number, ACResult[]>>({});
  const [runError, setRunError] = useState<Record<number, string>>({});

  async function refresh() {
    try {
      setBuilds(await listBuilds());
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load builds.");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await createBuild({
        name,
        attack_bonus: attackBonus,
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
      setName("New Build");
      await refresh();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Couldn't save build.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number) {
    await deleteBuild(id);
    await refresh();
  }

  async function handleRun(id: number) {
    const text = runAcText[id] ?? "12, 15, 18";
    const acList = text
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map(Number);

    try {
      const response = await calculateForBuild(id, acList);
      setRunResults((prev) => ({ ...prev, [id]: response.results }));
      setRunError((prev) => ({ ...prev, [id]: "" }));
    } catch (err) {
      setRunError((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : "Couldn't run this build.",
      }));
    }
  }

  return (
    <section>
      <h2>Saved builds</h2>
      {loadError && <p className="error">{loadError}</p>}
      {builds.length === 0 && !loadError && <p>No builds saved yet.</p>}

      {builds.map((build) => (
        <div className="build-card" key={build.id}>
          <div className="build-card-header">
            <strong>{build.name}</strong>
            <button onClick={() => handleDelete(build.id)} className="danger">
              Delete
            </button>
          </div>
          <p className="build-summary">
            +{build.attack_bonus} attack, {build.num_dice}d{build.die_sides}+{build.modifier}{" "}
            damage, {build.num_attacks} attack{build.num_attacks > 1 ? "s" : ""}/round
            {build.power_attack &&
              ` – power attack: +${build.power_attack_bonus} dmg / ${build.power_attack_penalty} to hit`}
          </p>

          <div className="run-row">
            <input
              value={runAcText[build.id] ?? "12, 15, 18"}
              onChange={(e) =>
                setRunAcText((prev) => ({ ...prev, [build.id]: e.target.value }))
              }
              placeholder="Target AC(s), comma-separated"
            />
            <button onClick={() => handleRun(build.id)}>Run</button>
          </div>

          {runError[build.id] && <p className="error">{runError[build.id]}</p>}
          {runResults[build.id] && <ResultsTable results={runResults[build.id]} />}
        </div>
      ))}

      <h3>Save a new build</h3>
      <form onSubmit={handleCreate} className="panel-form">
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="field-grid">
          <NumberField label="Attack bonus" value={attackBonus} onChange={setAttackBonus} />
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
            label="Crit range"
            value={critRange}
            onChange={setCritRange}
            min={2}
            max={20}
          />
        </div>
        <div className="field-grid">
          <CheckboxField label="Advantage" checked={advantage} onChange={setAdvantage} />
          <CheckboxField label="Disadvantage" checked={disadvantage} onChange={setDisadvantage} />
          <CheckboxField label="Power Attack" checked={powerAttack} onChange={setPowerAttack} />
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
        {createError && <p className="error">{createError}</p>}
        <button type="submit" disabled={creating}>
          {creating ? "Saving…" : "Save build"}
        </button>
      </form>
    </section>
  );
}
