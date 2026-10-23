import { useEffect, useState } from "react";
import { calculateForBuild, createBuild, deleteBuild, listBuilds, updateBuild } from "../api";
import {
  describeAttack,
  describeOncePerTurn,
  eligibleAttackNames,
  groupAttacks,
  groupLabel,
  parseAcList,
} from "../attacks";
import type { ACResult, Build, BuildCreate } from "../types";
import BuildForm from "./BuildForm";
import ResultsTable from "./ResultsTable";

const DEFAULT_AC_TEXT = "12, 15, 18";

function without<T>(record: Record<number, T>, key: number): Record<number, T> {
  const copy = { ...record };
  delete copy[key];
  return copy;
}

export default function BuildsPanel() {
  const [builds, setBuilds] = useState<Build[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);

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

  async function handleCreate(build: BuildCreate) {
    await createBuild(build);
    await refresh();
  }

  async function handleSaveEdit(id: number, build: BuildCreate) {
    await updateBuild(id, build);
    // Old results were for the old attacks -- drop them rather than show
    // numbers that no longer match the build.
    setRunResults((prev) => without(prev, id));
    setRunError((prev) => without(prev, id));
    setEditingId(null);
    await refresh();
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

      {builds.map((build) =>
        editingId === build.id ? (
          <div className="build-card editing" key={build.id}>
            <h3>Editing {build.name}</h3>
            <BuildForm
              initial={{
                name: build.name,
                attacks: build.attacks,
                once_per_turn: build.once_per_turn,
              }}
              submitLabel="Save changes"
              busyLabel="Saving…"
              onSubmit={(changes) => handleSaveEdit(build.id, changes)}
              onCancel={() => setEditingId(null)}
            />
          </div>
        ) : (
        <div className="build-card" key={build.id}>
          <div className="build-card-header">
            <strong>{build.name}</strong>
            <div className="build-card-actions">
              <button onClick={() => setEditingId(build.id)}>Edit</button>
              <button onClick={() => handleDelete(build.id)} className="danger">
                Delete
              </button>
            </div>
          </div>
          <ul className="build-summary">
            {groupAttacks(build.attacks).map((g) => (
              <li key={g.indices[0]}>
                <span className="attack-name">{groupLabel(g)}</span>: {describeAttack(g.attack)}
              </li>
            ))}
            {build.once_per_turn && (
              <li>
                <span className="attack-name">{build.once_per_turn.name}</span>:{" "}
                {describeOncePerTurn(build.once_per_turn)} once per turn, on the first hit by{" "}
                {eligibleAttackNames(build.attacks).join(" or ")}
              </li>
            )}
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
            <ResultsTable
              results={runResults[build.id]}
              attacks={build.attacks}
              oncePerTurn={build.once_per_turn}
            />
          )}
        </div>
        ),
      )}

      <h3>Save a new build</h3>
      <BuildForm
        submitLabel="Save build"
        busyLabel="Saving…"
        onSubmit={handleCreate}
        resetOnSuccess
      />
    </section>
  );
}
