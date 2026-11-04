import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api";
import { acResult, build, character } from "../test/fixtures";
import type { RoundToggles } from "../types";
import ComparePanel from "./ComparePanel";

vi.mock("../api");

const STORAGE_KEY = "powergaming.compare.v1";
const NO_TOGGLES: RoundToggles = {
  advantage: false,
  disadvantage: false,
  power_attack: false,
};
const AC_10_TO_25 = Array.from({ length: 16 }, (_, i) => 10 + i);

/** Damage that falls with AC; `offset` shifts an entry up or down. */
function resultsFor(acs: number[], offset: number) {
  return acs.map((ac) => acResult({ ac, total_had: 40 - ac + offset }));
}

function table() {
  return screen.getByRole("table", { name: "Damage per round by target AC" });
}

function bodyRows() {
  return within(within(table()).getAllByRole("rowgroup")[1]).getAllByRole(
    "row",
  );
}

describe("ComparePanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(api.listBuilds).mockResolvedValue([
      build({ id: 7, name: "GWM fighter" }),
    ]);
    vi.mocked(api.listCharacters).mockResolvedValue([
      character({ id: 3, name: "Vex" }),
    ]);
    vi.mocked(api.calculateForBuild).mockImplementation(async (_id, acs) => ({
      results: resultsFor(acs, 2),
    }));
    vi.mocked(api.calculateForCharacter).mockImplementation(
      async (_id, acs, toggles) => ({
        attacks: [],
        once_per_turn: null,
        power_attack_breakeven: null,
        results: resultsFor(acs, toggles.power_attack ? 5 : 0),
      }),
    );
  });

  async function addEntry(
    user: ReturnType<typeof userEvent.setup>,
    value: string,
  ) {
    await user.selectOptions(
      screen.getByLabelText("Add to the comparison"),
      value,
    );
    await user.click(screen.getByRole("button", { name: "Add" }));
  }

  it("compares a build and a character against AC 10-25 and marks the best", async () => {
    const user = userEvent.setup();
    render(<ComparePanel />);
    await screen.findByLabelText("Add to the comparison");
    expect(screen.getByText(/Nothing to compare yet/)).toBeInTheDocument();

    await addEntry(user, "build:7");
    await addEntry(user, "character:3");

    expect(
      await screen.findByRole("table", {
        name: "Damage per round by target AC",
      }),
    ).toBeInTheDocument();
    expect(api.calculateForBuild).toHaveBeenLastCalledWith(7, AC_10_TO_25);
    expect(api.calculateForCharacter).toHaveBeenLastCalledWith(
      3,
      AC_10_TO_25,
      NO_TOGGLES,
    );
    expect(
      screen.getAllByRole("columnheader").map((h) => h.textContent),
    ).toEqual(["AC", "GWM fighter", "Vex", "Best"]);
    expect(bodyRows()).toHaveLength(16);
    // AC 10: build 32.00, Vex 30.00 -> the build is best.
    expect(
      within(bodyRows()[0])
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual(["32.00", "30.00", "GWM fighter"]);
    expect(
      screen.getByRole("img", {
        name: /Line chart of damage per round from AC 10 to 25/,
      }),
    ).toBeInTheDocument();
  });

  it("gives each character entry its own toggles, so the same character can appear twice", async () => {
    const user = userEvent.setup();
    render(<ComparePanel />);
    await screen.findByLabelText("Add to the comparison");
    await addEntry(user, "character:3");
    await addEntry(user, "character:3");

    const second = screen.getAllByRole("listitem")[1];
    await user.click(within(second).getByLabelText("Power attack"));

    expect(api.calculateForCharacter).toHaveBeenLastCalledWith(3, AC_10_TO_25, {
      ...NO_TOGGLES,
      power_attack: true,
    });
    expect(
      await screen.findByRole("columnheader", { name: "Vex (power attack)" }),
    ).toBeInTheDocument();
    // AC 10: plain 30.00, power attack 35.00.
    expect(
      within(bodyRows()[0])
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual(["30.00", "35.00", "Vex (power attack)"]);
  });

  it("numbers identical entries and reports ties", async () => {
    const user = userEvent.setup();
    render(<ComparePanel />);
    await screen.findByLabelText("Add to the comparison");
    await addEntry(user, "character:3");
    await addEntry(user, "character:3");

    expect(
      await screen.findByRole("columnheader", { name: "Vex #1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Vex #2" }),
    ).toBeInTheDocument();
    expect(within(bodyRows()[0]).getAllByRole("cell")[2]).toHaveTextContent(
      "Tie: Vex #1, Vex #2",
    );
  });

  it("stops at 4 entries and can remove them", async () => {
    const user = userEvent.setup();
    render(<ComparePanel />);
    await screen.findByLabelText("Add to the comparison");
    for (let i = 0; i < 4; i++) await addEntry(user, "build:7");

    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    await user.selectOptions(
      screen.getByLabelText("Add to the comparison"),
      "build:7",
    );
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    expect(screen.getByText(/maximum of 4/)).toBeInTheDocument();

    await user.click(
      within(screen.getAllByRole("listitem")[0]).getByRole("button", {
        name: "Remove",
      }),
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();
  });

  it("uses an edited AC range and rejects an inverted one", async () => {
    const user = userEvent.setup();
    render(<ComparePanel />);
    await screen.findByLabelText("Add to the comparison");
    await addEntry(user, "build:7");
    await screen.findByRole("table", { name: "Damage per round by target AC" });

    await user.clear(screen.getByLabelText("To AC"));
    await user.type(screen.getByLabelText("To AC"), "12");
    expect(api.calculateForBuild).toHaveBeenLastCalledWith(7, [10, 11, 12]);

    vi.mocked(api.calculateForBuild).mockClear();
    await user.clear(screen.getByLabelText("From AC"));
    await user.type(screen.getByLabelText("From AC"), "15");
    expect(
      screen.getByText("The AC range must go from low to high, within 1-30."),
    ).toBeInTheDocument();
    expect(api.calculateForBuild).not.toHaveBeenCalledWith(7, []);
  });

  it("remembers the last comparison in the browser and drops deleted entries", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        entries: [
          { kind: "build", id: 7 },
          { kind: "character", id: 99, toggles: NO_TOGGLES }, // deleted since
          {
            kind: "character",
            id: 3,
            toggles: { ...NO_TOGGLES, advantage: true },
          },
        ],
        acMin: 12,
        acMax: 14,
      }),
    );
    render(<ComparePanel />);

    expect(
      await screen.findByRole("table", {
        name: "Damage per round by target AC",
      }),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("listitem")
        .map((li) => li.getAttribute("aria-label")),
    ).toEqual(["GWM fighter", "Vex (advantage)"]);
    expect(api.calculateForCharacter).toHaveBeenLastCalledWith(
      3,
      [12, 13, 14],
      {
        ...NO_TOGGLES,
        advantage: true,
      },
    );
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(stored.entries).toHaveLength(2);
  });

  it("starts fresh if the remembered comparison is unreadable", async () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");
    render(<ComparePanel />);
    expect(
      await screen.findByText(/Nothing to compare yet/),
    ).toBeInTheDocument();
  });
});
