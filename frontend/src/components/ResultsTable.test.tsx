import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { acResult } from "../test/fixtures";
import ResultsTable from "./ResultsTable";

function rows() {
  return screen.getAllByRole("row").slice(1); // skip the header row
}

describe("ResultsTable", () => {
  it("renders one row per AC with percentages and two-decimal damage", () => {
    render(
      <ResultsTable
        results={[
          acResult({ ac: 12, hit_chance: 0.7, crit_chance: 0.05, had: 6.125, total_had_per_round: 12.25 }),
          acResult({ ac: 18, hit_chance: 0.4 }),
        ]}
      />,
    );

    expect(rows()).toHaveLength(2);
    const cells = within(rows()[0]).getAllByRole("cell").map((c) => c.textContent);
    expect(cells).toEqual(["12", "70.0%", "5.0%", "6.13", "12.25"]);
  });

  it("hides the power-attack columns when no result has power data", () => {
    render(<ResultsTable results={[acResult()]} />);
    expect(screen.queryByRole("columnheader", { name: "Power HAD" })).not.toBeInTheDocument();
  });

  it("shows power-attack columns, with a dash where a row has none", () => {
    render(
      <ResultsTable
        results={[
          acResult({ ac: 12, power_hit_chance: 0.45, power_had: 9.5, power_total_had_per_round: 19 }),
          acResult({ ac: 20 }),
        ]}
      />,
    );

    expect(screen.getByRole("columnheader", { name: "Power HAD" })).toBeInTheDocument();
    const [withPower, without] = rows().map((r) =>
      within(r).getAllByRole("cell").map((c) => c.textContent),
    );
    expect(withPower.slice(5)).toEqual(["45.0%", "9.50", "19.00"]);
    expect(without.slice(5)).toEqual(["–", "–", "–"]);
  });
});
