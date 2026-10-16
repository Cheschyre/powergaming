import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { acResult, attackResult, greatsword, handaxe } from "../test/fixtures";
import ResultsTable from "./ResultsTable";

function bodyRows() {
  return within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row");
}

function cells(row: HTMLElement) {
  return within(row).getAllByRole("cell").map((c) => c.textContent);
}

describe("ResultsTable", () => {
  it("uses the compact table when every attack is the same", () => {
    render(
      <ResultsTable
        attacks={[greatsword, { ...greatsword }]}
        results={[
          acResult({
            ac: 12,
            attacks: [attackResult({ hit_chance: 0.8, had: 9.6 }), attackResult({ hit_chance: 0.8, had: 9.6 })],
            total_had: 19.2,
          }),
          acResult({ ac: 18 }, 2),
        ]}
      />,
    );

    expect(screen.getByText("Greatsword ×2")).toBeInTheDocument(); // caption
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "AC",
      "Hit%",
      "Crit%",
      "Damage per attack",
      "Damage per round",
    ]);
    expect(bodyRows()).toHaveLength(2);
    expect(cells(bodyRows()[0])).toEqual(["12", "80.0%", "5.0%", "9.60", "19.20"]);
  });

  it("groups identical attacks into columns when the attacks differ", () => {
    render(
      <ResultsTable
        attacks={[greatsword, handaxe, greatsword]}
        results={[
          acResult({
            ac: 15,
            attacks: [
              attackResult({ hit_chance: 0.7, had: 8.75 }),
              attackResult({ hit_chance: 0.7, had: 2.63 }),
              attackResult({ hit_chance: 0.7, had: 8.75 }),
            ],
            total_had: 20.13,
          }),
        ]}
      />,
    );

    expect(screen.getByRole("columnheader", { name: "Greatsword ×2" })).toHaveAttribute("colspan", "2");
    expect(screen.getByRole("columnheader", { name: "Handaxe" })).toBeInTheDocument();
    // AC | greatsword hit, dmg (both swings) | handaxe hit, dmg | round total
    expect(cells(bodyRows()[0])).toEqual(["15", "70.0%", "17.50", "70.0%", "2.63", "20.13"]);
  });

  it("shows the round total from the API, not a client-side sum", () => {
    render(
      <ResultsTable
        attacks={[greatsword, handaxe]}
        results={[acResult({ attacks: [attackResult({ had: 1 }), attackResult({ had: 2 })], total_had: 99 })]}
      />,
    );
    expect(cells(bodyRows()[0]).at(-1)).toBe("99.00");
  });

  it("splits a power-attack swing into its own group and shows the no-PA comparison", () => {
    const pa = { ...greatsword, power_attack: true };
    render(
      <ResultsTable
        attacks={[pa, greatsword]}
        results={[
          acResult({
            attacks: [attackResult({ hit_chance: 0.45, had: 10.25 }), attackResult()],
            total_had: 19,
            total_had_without_power_attack: 17.5,
          }),
        ]}
      />,
    );

    expect(screen.getByRole("columnheader", { name: "Greatsword (PA)" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Greatsword" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Without power attack" })).toBeInTheDocument();
    expect(cells(bodyRows()[0])).toEqual(["15", "45.0%", "10.25", "70.0%", "8.75", "19.00", "17.50"]);
  });

  it("hides the no-PA column when no attack uses power attack", () => {
    render(<ResultsTable attacks={[greatsword]} results={[acResult()]} />);
    expect(screen.queryByRole("columnheader", { name: "Without power attack" })).not.toBeInTheDocument();
  });
});
