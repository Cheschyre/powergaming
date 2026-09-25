import type { ACResult } from "../types";

interface ResultsTableProps {
  results: ACResult[];
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default function ResultsTable({ results }: ResultsTableProps) {
  const hasPower = results.some((r) => r.power_had !== null);

  return (
    <table className="results-table">
      <thead>
        <tr>
          <th>AC</th>
          <th>Hit%</th>
          <th>Crit%</th>
          <th>HAD</th>
          <th>Total HAD/round</th>
          {hasPower && (
            <>
              <th>Power Hit%</th>
              <th>Power HAD</th>
              <th>Power Total/round</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {results.map((r) => (
          <tr key={r.ac}>
            <td>{r.ac}</td>
            <td>{pct(r.hit_chance)}</td>
            <td>{pct(r.crit_chance)}</td>
            <td>{r.had.toFixed(2)}</td>
            <td>{r.total_had_per_round.toFixed(2)}</td>
            {hasPower && (
              <>
                <td>{r.power_hit_chance !== null ? pct(r.power_hit_chance) : "–"}</td>
                <td>{r.power_had !== null ? r.power_had.toFixed(2) : "–"}</td>
                <td>
                  {r.power_total_had_per_round !== null
                    ? r.power_total_had_per_round.toFixed(2)
                    : "–"}
                </td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
