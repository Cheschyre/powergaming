import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as api from "../api";
import { acResult, character } from "../test/fixtures";
import type { LevelRow, RoundToggles } from "../types";
import LevelView from "./LevelView";

vi.mock("../api");

const NO_TOGGLES: RoundToggles = {
  advantage: false,
  disadvantage: false,
  power_attack: false,
};

function levelRows(acs: number, withoutPa = false): LevelRow[] {
  return levelRowsWith(acs, withoutPa, () => null);
}

function levelRowsWith(
  acs: number,
  withoutPa: boolean,
  breakeven: (level: number) => LevelRow["power_attack_breakeven"],
): LevelRow[] {
  return Array.from({ length: 20 }, (_, i) => ({
    level: i + 1,
    strength: 10,
    dexterity: i + 1 >= 4 ? 18 : 16,
    notes: i + 1 === 4 ? ["+2 DEX"] : i + 1 === 5 ? ["Proficiency +3"] : [],
    power_attack_breakeven: breakeven(i + 1),
    attacks: [],
    once_per_turn: null,
    results: Array.from({ length: acs }, (_, a) =>
      acResult({
        ac: 13 + 2 * a,
        total_had: 5 + i + a / 10,
        total_had_without_power_attack: withoutPa ? 4 + i : null,
      }),
    ),
  }));
}

function bodyRows() {
  const table = screen.getByRole("table", {
    name: "Damage per round by level",
  });
  return within(within(table).getAllByRole("rowgroup")[1]).getAllByRole("row");
}

describe("LevelView", () => {
  it("loads levels 1-20 against the default ACs with the card's toggles", async () => {
    vi.mocked(api.levelsForCharacter).mockResolvedValue({ rows: levelRows(3) });
    const toggles = { ...NO_TOGGLES, advantage: true };
    render(<LevelView character={character()} toggles={toggles} />);

    expect(
      await screen.findByRole("table", { name: "Damage per round by level" }),
    ).toBeInTheDocument();
    expect(api.levelsForCharacter).toHaveBeenCalledWith(
      1,
      [13, 15, 17],
      toggles,
    );
    expect(bodyRows()).toHaveLength(20);
    const headers = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(headers).toEqual([
      "Level",
      "STR",
      "DEX",
      "AC 13",
      "AC 15",
      "AC 17",
      "What changes",
    ]);
    expect(
      within(bodyRows()[3])
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual(["10", "18", "8.00", "8.10", "8.20", "+2 DEX"]);
    // The chart is labelled, and the table carries every value it shows.
    expect(
      screen.getByRole("img", { name: /Line chart of damage per round/ }),
    ).toBeInTheDocument();
  });

  it("marks the character's current level", async () => {
    vi.mocked(api.levelsForCharacter).mockResolvedValue({ rows: levelRows(3) });
    render(
      <LevelView character={character({ level: 5 })} toggles={NO_TOGGLES} />,
    );
    await screen.findByRole("table", { name: "Damage per round by level" });
    expect(bodyRows()[4]).toHaveAttribute("aria-current", "true");
    expect(bodyRows()[3]).not.toHaveAttribute("aria-current");
  });

  it("adds without-power-attack columns when power attack is on", async () => {
    vi.mocked(api.levelsForCharacter).mockResolvedValue({
      rows: levelRows(1, true),
    });
    const user = userEvent.setup();
    render(
      <LevelView
        character={character()}
        toggles={{ ...NO_TOGGLES, power_attack: true }}
      />,
    );
    await screen.findByRole("table", { name: "Damage per round by level" });

    // (Mocked: one AC came back.) Change the ACs to match.
    await user.clear(screen.getByLabelText(/Target ACs for the level view/));
    await user.type(
      screen.getByLabelText(/Target ACs for the level view/),
      "16",
    );
    await user.click(screen.getByRole("button", { name: "Update" }));
    expect(api.levelsForCharacter).toHaveBeenLastCalledWith(1, [16], {
      ...NO_TOGGLES,
      power_attack: true,
    });
    expect(
      screen.getByRole("columnheader", { name: "AC 16 without power attack" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Dashed: same AC without power attack"),
    ).toBeInTheDocument();
  });

  it("refuses more than 3 ACs without calling the API again", async () => {
    vi.mocked(api.levelsForCharacter).mockResolvedValue({ rows: levelRows(3) });
    const user = userEvent.setup();
    render(<LevelView character={character()} toggles={NO_TOGGLES} />);
    await screen.findByRole("table", { name: "Damage per round by level" });

    await user.clear(screen.getByLabelText(/Target ACs for the level view/));
    await user.type(
      screen.getByLabelText(/Target ACs for the level view/),
      "11, 13, 15, 17",
    );
    await user.click(screen.getByRole("button", { name: "Update" }));

    expect(
      screen.getByText("Enter 1 to 3 target ACs, comma-separated."),
    ).toBeInTheDocument();
    expect(api.levelsForCharacter).toHaveBeenCalledTimes(1);
  });

  it("shows the API error", async () => {
    vi.mocked(api.levelsForCharacter).mockRejectedValue(
      new Error("422: ac_list: too long"),
    );
    render(<LevelView character={character()} toggles={NO_TOGGLES} />);
    expect(
      await screen.findByText("422: ac_list: too long"),
    ).toBeInTheDocument();
  });

  it("adds each level's power-attack breakeven when power attack is on", async () => {
    vi.mocked(api.levelsForCharacter).mockResolvedValue({
      rows: levelRowsWith(3, true, (level) =>
        level < 4
          ? { status: "not_applicable", ac: null }
          : { status: "pays_off_up_to", ac: 12 + level },
      ),
    });
    render(
      <LevelView
        character={character()}
        toggles={{ ...NO_TOGGLES, power_attack: true }}
      />,
    );
    await screen.findByRole("table", { name: "Damage per round by level" });

    expect(
      screen.getByRole("columnheader", { name: "Power attack pays off up to" }),
    ).toBeInTheDocument();
    const cells = (n: number) =>
      within(bodyRows()[n])
        .getAllByRole("cell")
        .map((c) => c.textContent);
    expect(cells(2)).toContain("–"); // level 3: feat not taken yet
    expect(cells(4)).toContain("AC 17"); // level 5
  });

  it("has no breakeven column with power attack off", async () => {
    vi.mocked(api.levelsForCharacter).mockResolvedValue({ rows: levelRows(3) });
    render(<LevelView character={character()} toggles={NO_TOGGLES} />);
    await screen.findByRole("table", { name: "Damage per round by level" });
    expect(
      screen.queryByRole("columnheader", {
        name: "Power attack pays off up to",
      }),
    ).not.toBeInTheDocument();
  });
});
