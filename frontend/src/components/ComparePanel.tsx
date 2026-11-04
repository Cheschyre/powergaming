import { useEffect, useMemo, useState } from "react";
import {
  calculateForBuild,
  calculateForCharacter,
  listBuilds,
  listCharacters,
} from "../api";
import { SERIES_COLORS } from "../chartColors";
import { describeCharacter } from "../characters";
import type { ACResult, Build, Character, RoundToggles } from "../types";
import CheckboxField from "./CheckboxField";
import DamageLineChart from "./DamageLineChart";
import NumberField from "./NumberField";
import SelectField from "./SelectField";

export const MAX_COMPARE_ENTRIES = 4;
const STORAGE_KEY = "powergaming.compare.v1";
const NO_TOGGLES: RoundToggles = {
  advantage: false,
  disadvantage: false,
  power_attack: false,
};

export type CompareEntry =
  | { kind: "build"; id: number }
  | { kind: "character"; id: number; toggles: RoundToggles };

interface Saved {
  entries: CompareEntry[];
  acMin: number;
  acMax: number;
}

// The last comparison is remembered per browser -- a convenience, so any
// storage error just means starting fresh.
function loadSaved(): Saved {
  const fallback: Saved = { entries: [], acMin: 10, acMax: 25 };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Saved>;
    return {
      entries: Array.isArray(parsed.entries)
        ? parsed.entries.slice(0, MAX_COMPARE_ENTRIES)
        : [],
      acMin: typeof parsed.acMin === "number" ? parsed.acMin : fallback.acMin,
      acMax: typeof parsed.acMax === "number" ? parsed.acMax : fallback.acMax,
    };
  } catch {
    return fallback;
  }
}

function save(saved: Saved) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // storage unavailable (private window, blocked) -- not remembered, that's all
  }
}

const TOGGLE_NAMES: [keyof RoundToggles, string][] = [
  ["power_attack", "power attack"],
  ["advantage", "advantage"],
  ["disadvantage", "disadvantage"],
];

function truncate(text: string, max = 16): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Up to 4 saved builds and characters side by side against a range of ACs. */
export default function ComparePanel() {
  const [builds, setBuilds] = useState<Build[] | null>(null);
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [initial] = useState(loadSaved);
  const [entries, setEntries] = useState<CompareEntry[]>(initial.entries);
  const [acMin, setAcMin] = useState(initial.acMin);
  const [acMax, setAcMax] = useState(initial.acMax);
  const [picked, setPicked] = useState("");

  const [results, setResults] = useState<ACResult[][] | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [b, c] = await Promise.all([listBuilds(), listCharacters()]);
        setBuilds(b);
        setCharacters(c);
        // Drop remembered entries whose build or character was deleted.
        setEntries((prev) =>
          prev.filter((e) =>
            e.kind === "build"
              ? b.some((x) => x.id === e.id)
              : c.some((x) => x.id === e.id),
          ),
        );
      } catch (err) {
        setLoadError(
          err instanceof Error
            ? err.message
            : "Couldn't load builds and characters.",
        );
      }
    }
    load();
  }, []);

  useEffect(() => save({ entries, acMin, acMax }), [entries, acMin, acMax]);

  const rangeError =
    acMin < 1 || acMax > 30 || acMin > acMax
      ? "The AC range must go from low to high, within 1-30."
      : null;
  const acs = useMemo(
    () =>
      rangeError
        ? []
        : Array.from({ length: acMax - acMin + 1 }, (_, i) => acMin + i),
    [acMin, acMax, rangeError],
  );
  const loaded = builds !== null && characters !== null;

  // Recalculate whenever the entries, their toggles or the AC range change.
  useEffect(() => {
    if (!loaded || entries.length === 0 || acs.length === 0) return;
    let cancelled = false;
    async function run() {
      try {
        const all = await Promise.all(
          entries.map(async (e) =>
            e.kind === "build"
              ? (await calculateForBuild(e.id, acs)).results
              : (await calculateForCharacter(e.id, acs, e.toggles)).results,
          ),
        );
        if (!cancelled) {
          setResults(all);
          setRunError(null);
        }
      } catch (err) {
        if (!cancelled)
          setRunError(
            err instanceof Error ? err.message : "Couldn't compare these.",
          );
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [loaded, entries, acs]);

  function label(entry: CompareEntry): string {
    if (entry.kind === "build")
      return builds?.find((b) => b.id === entry.id)?.name ?? "Build";
    const name =
      characters?.find((c) => c.id === entry.id)?.name ?? "Character";
    const on = TOGGLE_NAMES.filter(([key]) => entry.toggles[key]).map(
      ([, text]) => text,
    );
    return on.length ? `${name} (${on.join(", ")})` : name;
  }

  // Identical labels (the same character twice with the same toggles) get
  // numbered so the legend, table and lines stay tellable apart.
  const labels = entries.map(label);
  const uniqueLabels = labels.map((l, i) =>
    labels.filter((x) => x === l).length > 1
      ? `${l} #${labels.slice(0, i + 1).filter((x) => x === l).length}`
      : l,
  );

  function add() {
    if (!picked || entries.length >= MAX_COMPARE_ENTRIES) return;
    const [kind, id] = picked.split(":");
    setEntries((prev) => [
      ...prev,
      kind === "build"
        ? { kind: "build", id: Number(id) }
        : { kind: "character", id: Number(id), toggles: NO_TOGGLES },
    ]);
    setPicked("");
  }

  function setToggle(index: number, changes: Partial<RoundToggles>) {
    setEntries((prev) =>
      prev.map((e, i) =>
        i === index && e.kind === "character"
          ? { ...e, toggles: { ...e.toggles, ...changes } }
          : e,
      ),
    );
  }

  const shown =
    results &&
    results.length === entries.length &&
    results[0]?.length === acs.length
      ? results
      : null;
  const full = entries.length >= MAX_COMPARE_ENTRIES;

  return (
    <section>
      <h2>Compare</h2>
      <p className="hint">
        Up to {MAX_COMPARE_ENTRIES} saved builds and characters, side by side.
        Characters run at their own level, each with its own toggles -- add the
        same character twice to compare power attack on and off.
      </p>
      {loadError && <p className="error">{loadError}</p>}
      {!loaded && !loadError && <p>Loading…</p>}
      {loaded && (
        <>
          <div className="panel-form">
            <div className="field-grid">
              <SelectField
                label="Add to the comparison"
                value={picked}
                onChange={setPicked}
              >
                <option value="">Choose a build or character…</option>
                {builds.length > 0 && (
                  <optgroup label="Saved builds">
                    {builds.map((b) => (
                      <option key={b.id} value={`build:${b.id}`}>
                        {b.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {characters.length > 0 && (
                  <optgroup label="Characters">
                    {characters.map((c) => (
                      <option key={c.id} value={`character:${c.id}`}>
                        {c.name} -- {describeCharacter(c)}
                      </option>
                    ))}
                  </optgroup>
                )}
              </SelectField>
              <div className="field field-button">
                <button type="button" onClick={add} disabled={!picked || full}>
                  Add
                </button>
              </div>
              <NumberField
                label="From AC"
                value={acMin}
                onChange={setAcMin}
                min={1}
                max={30}
              />
              <NumberField
                label="To AC"
                value={acMax}
                onChange={setAcMax}
                min={1}
                max={30}
              />
            </div>
            {full && (
              <p className="hint">
                That's the maximum of {MAX_COMPARE_ENTRIES}; remove one to add
                another.
              </p>
            )}
            {rangeError && <p className="error">{rangeError}</p>}

            {entries.length === 0 && (
              <p>Nothing to compare yet -- add a build or character above.</p>
            )}
            <ul className="compare-entries">
              {entries.map((entry, i) => (
                <li
                  key={i}
                  className="compare-entry"
                  aria-label={uniqueLabels[i]}
                >
                  <svg width="16" height="4" aria-hidden="true">
                    <line
                      x1="0"
                      y1="2"
                      x2="16"
                      y2="2"
                      stroke={SERIES_COLORS[i]}
                      strokeWidth="2"
                    />
                  </svg>
                  <strong>{uniqueLabels[i]}</strong>
                  <span className="hint">
                    {entry.kind === "build" ? "Build" : "Character"}
                  </span>
                  {entry.kind === "character" && (
                    <span className="compare-toggles">
                      <CheckboxField
                        label="Power attack"
                        checked={entry.toggles.power_attack}
                        onChange={(v) => setToggle(i, { power_attack: v })}
                      />
                      <CheckboxField
                        label="Advantage"
                        checked={entry.toggles.advantage}
                        onChange={(v) => setToggle(i, { advantage: v })}
                      />
                      <CheckboxField
                        label="Disadvantage"
                        checked={entry.toggles.disadvantage}
                        onChange={(v) => setToggle(i, { disadvantage: v })}
                      />
                    </span>
                  )}
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      setEntries((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {runError && <p className="error">{runError}</p>}
          {shown && entries.length > 0 && (
            <>
              <DamageLineChart
                title="Damage per round by target AC"
                ariaLabel={`Line chart of damage per round from AC ${acMin} to ${acMax} for ${uniqueLabels.join(", ")}. The table below lists every value.`}
                points={acs.map((ac, a) => {
                  const point: Record<string, number> = { ac };
                  shown.forEach((r, i) => (point[`e${i}`] = r[a].total_had));
                  return point;
                })}
                xKey="ac"
                xDomain={[acMin, acMax]}
                xHeading={(ac) => `AC ${ac}`}
                series={entries.map((_, i) => ({
                  key: `e${i}`,
                  label: uniqueLabels[i],
                  color: SERIES_COLORS[i],
                  endLabel: truncate(uniqueLabels[i]),
                }))}
                legend={entries.map((_, i) => ({
                  label: uniqueLabels[i],
                  color: SERIES_COLORS[i],
                }))}
              />
              <table className="results-table compare-table">
                <caption>Damage per round by target AC</caption>
                <thead>
                  <tr>
                    <th scope="col">AC</th>
                    {uniqueLabels.map((l, i) => (
                      <th scope="col" key={i}>
                        {l}
                      </th>
                    ))}
                    <th scope="col">Best</th>
                  </tr>
                </thead>
                <tbody>
                  {acs.map((ac, a) => {
                    const totals = shown.map((r) => r[a].total_had);
                    const top = Math.max(...totals);
                    // Rounded the same way as shown, so a "tie" is a tie on screen.
                    const best = totals.flatMap((t, i) =>
                      t.toFixed(2) === top.toFixed(2) ? [i] : [],
                    );
                    return (
                      <tr key={ac}>
                        <th scope="row">{ac}</th>
                        {totals.map((t, i) => (
                          <td
                            key={i}
                            className={
                              best.includes(i) && entries.length > 1
                                ? "best"
                                : undefined
                            }
                          >
                            {t.toFixed(2)}
                          </td>
                        ))}
                        <td className="level-notes">
                          {entries.length < 2
                            ? "–"
                            : best.length > 1
                              ? `Tie: ${best.map((i) => uniqueLabels[i]).join(", ")}`
                              : uniqueLabels[best[0]]}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </section>
  );
}
