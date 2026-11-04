import { useEffect, useState } from "react";
import { levelsForCharacter } from "../api";
import { parseAcList } from "../attacks";
import type { Character, LevelRow, RoundToggles } from "../types";
import LevelChart from "./LevelChart";

export const MAX_LEVEL_VIEW_ACS = 3; // matches MAX_LEVEL_VIEW_ACS in backend/app/schemas.py
const DEFAULT_AC_TEXT = "13, 15, 17";

interface LevelViewProps {
  character: Character;
  /** The card's round toggles -- applied at every level. */
  toggles: RoundToggles;
}

/** The character rebuilt at levels 1-20 against up to 3 ACs: a chart and
 * the table it's drawn from. */
export default function LevelView({ character, toggles }: LevelViewProps) {
  const [acText, setAcText] = useState(DEFAULT_AC_TEXT);
  const [acList, setAcList] = useState<number[]>(parseAcList(DEFAULT_AC_TEXT));
  const [rows, setRows] = useState<LevelRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load on open, and again when the ACs or the card's toggles change.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await levelsForCharacter(
          character.id,
          acList,
          toggles,
        );
        if (!cancelled) {
          setRows(response.rows);
          setError(null);
        }
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Couldn't load levels.",
          );
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [character.id, acList, toggles]);

  function applyAcs() {
    const parsed = parseAcList(acText);
    if (parsed.length === 0 || parsed.length > MAX_LEVEL_VIEW_ACS) {
      setError(`Enter 1 to ${MAX_LEVEL_VIEW_ACS} target ACs, comma-separated.`);
      return;
    }
    setError(null);
    setAcList(parsed);
  }

  const shownAcs = rows
    ? acList.slice(0, rows[0]?.results.length ?? 0)
    : acList;
  const withoutPa = !!rows?.some((r) =>
    r.results.some((x) => x.total_had_without_power_attack !== null),
  );

  return (
    <section
      className="level-view"
      aria-label={`${character.name} at levels 1 to 20`}
    >
      <div className="run-row">
        <input
          value={acText}
          onChange={(e) => setAcText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyAcs()}
          aria-label="Target ACs for the level view (up to 3)"
          placeholder="Up to 3 target ACs, comma-separated"
        />
        <button onClick={applyAcs}>Update</button>
      </div>
      {error && <p className="error">{error}</p>}
      {rows && (
        <>
          <LevelChart
            rows={rows}
            acList={shownAcs}
            showWithoutPowerAttack={withoutPa}
          />
          <table className="results-table level-table">
            <caption>Damage per round by level</caption>
            <thead>
              <tr>
                <th scope="col">Level</th>
                <th scope="col">STR</th>
                <th scope="col">DEX</th>
                {shownAcs.map((ac, i) => (
                  <th scope="col" key={`ac${i}`}>
                    AC {ac}
                  </th>
                ))}
                {withoutPa &&
                  shownAcs.map((ac, i) => (
                    <th scope="col" key={`noPa${i}`}>
                      AC {ac} without power attack
                    </th>
                  ))}
                <th scope="col">What changes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.level}
                  className={
                    row.level === character.level ? "current-level" : undefined
                  }
                  aria-current={
                    row.level === character.level ? "true" : undefined
                  }
                >
                  <th scope="row">{row.level}</th>
                  <td>{row.strength}</td>
                  <td>{row.dexterity}</td>
                  {row.results.map((r, i) => (
                    <td key={`ac${i}`} className="round-total">
                      {r.total_had.toFixed(2)}
                    </td>
                  ))}
                  {withoutPa &&
                    row.results.map((r, i) => (
                      <td key={`noPa${i}`}>
                        {r.total_had_without_power_attack?.toFixed(2) ?? "–"}
                      </td>
                    ))}
                  <td className="level-notes">{row.notes.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
