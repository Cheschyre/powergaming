import { useEffect, useState, type FormEvent } from "react";
import { calculateForBuild, createBuild, deleteBuild, listBuilds } from "../api";
import { describeAttack, groupAttacks, groupLabel, newAttack, parseAcList } from "../attacks";
import type { ACResult, AttackEntry, Build } from "../types";
import AttackListEditor from "./AttackListEditor";
import ResultsTable from "./ResultsTable";

const DEFAULT_AC_TEXT = "12, 15, 18";

export default function BuildsPanel() {
  const [builds, setBuilds] = useState<Build[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("New Build");
  const [attacks, setAttacks] = useState<AttackEntry[]>([newAttack()]);
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
      await createBuild({ name, attacks });
      setName("New Build");
      setAttacks([newAttack()]);
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
    try {
      const response = await calculateForBuild(id, parseAcList(runAcText[id] ?? DEFAULT_AC_TEXT));
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
          <ul className="build-summary">
            {groupAttacks(build.attacks).map((g) => (
              <li key={g.indices[0]}>
                <span className="attack-name">{groupLabel(g)}</span>: {describeAttack(g.attack)}
              </li>
            ))}
          </ul>

          <div className="run-row">
            <input
              value={runAcText[build.id] ?? DEFAULT_AC_TEXT}
              onChange={(e) =>
                setRunAcText((prev) => ({ ...prev, [build.id]: e.target.value }))
              }
              placeholder="Target AC(s), comma-separated"
              aria-label={`Target ACs for ${build.name}`}
            />
            <button onClick={() => handleRun(build.id)}>Run</button>
          </div>

          {runError[build.id] && <p className="error">{runError[build.id]}</p>}
          {runResults[build.id] && (
            <ResultsTable results={runResults[build.id]} attacks={build.attacks} />
          )}
        </div>
      ))}

      <h3>Save a new build</h3>
      <form onSubmit={handleCreate} className="panel-form">
        <div className="field-grid">
          <label className="field">
            <span>Build name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        </div>
        <AttackListEditor attacks={attacks} onChange={setAttacks} />
        {createError && <p className="error">{createError}</p>}
        <button type="submit" disabled={creating}>
          {creating ? "Saving…" : "Save build"}
        </button>
      </form>
    </section>
  );
}
