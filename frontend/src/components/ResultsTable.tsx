import { groupAttacks, groupLabel } from "../attacks";
import type { ACResult, AttackEntry } from "../types";

interface ResultsTableProps {
  results: ACResult[];
  /** The attacks these results were calculated for, in the same order. */
  attacks: AttackEntry[];
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * One row per target AC. If every attack in the round is identical (e.g.
 * Extra Attack with one weapon) this is the compact single-attack table;
 * otherwise identical attacks are grouped ("Greatsword ×2") and each group
 * gets its own Hit% and damage columns. The round total always comes from
 * the API (`total_had`), never summed here.
 */
export default function ResultsTable({ results, attacks }: ResultsTableProps) {
  const groups = groupAttacks(attacks);
  const showWithoutPa = results.some((r) => r.total_had_without_power_attack !== null);
  const withoutPaCell = (r: ACResult) =>
    showWithoutPa && (
      <td>
        {r.total_had_without_power_attack !== null
          ? r.total_had_without_power_attack.toFixed(2)
          : "–"}
      </td>
    );

  if (groups.length === 1) {
    const [group] = groups;
    const first = group.indices[0];
    return (
      <table className="results-table">
        <caption>{groupLabel(group)}</caption>
        <thead>
          <tr>
            <th>AC</th>
            <th>Hit%</th>
            <th>Crit%</th>
            <th>Damage per attack</th>
            <th>Damage per round</th>
            {showWithoutPa && <th>Without power attack</th>}
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.ac}>
              <td>{r.ac}</td>
              <td>{pct(r.attacks[first].hit_chance)}</td>
              <td>{pct(r.attacks[first].crit_chance)}</td>
              <td>{r.attacks[first].had.toFixed(2)}</td>
              <td>{r.total_had.toFixed(2)}</td>
              {withoutPaCell(r)}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <table className="results-table grouped">
      <thead>
        <tr>
          <th rowSpan={2}>AC</th>
          {groups.map((g) => (
            <th key={g.indices[0]} colSpan={2} scope="colgroup" className="group-head">
              {groupLabel(g)}
            </th>
          ))}
          <th rowSpan={2}>Damage per round</th>
          {showWithoutPa && <th rowSpan={2}>Without power attack</th>}
        </tr>
        <tr>
          {groups.map((g) => [
            <th key={`${g.indices[0]}-hit`}>Hit%</th>,
            <th key={`${g.indices[0]}-dmg`}>Damage</th>,
          ])}
        </tr>
      </thead>
      <tbody>
        {results.map((r) => (
          <tr key={r.ac}>
            <td>{r.ac}</td>
            {groups.map((g) => [
              <td key={`${g.indices[0]}-hit`}>{pct(r.attacks[g.indices[0]].hit_chance)}</td>,
              <td key={`${g.indices[0]}-dmg`}>
                {g.indices.reduce((sum, i) => sum + r.attacks[i].had, 0).toFixed(2)}
              </td>,
            ])}
            <td className="round-total">{r.total_had.toFixed(2)}</td>
            {withoutPaCell(r)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
