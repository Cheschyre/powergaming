import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api";
import { newAttack } from "../attacks";
import { acResult } from "../test/fixtures";
import CalculatorPanel from "./CalculatorPanel";

vi.mock("../api");

function row(n: number) {
  return screen.getByRole("group", { name: `Attack ${n}` });
}

describe("CalculatorPanel", () => {
  beforeEach(() => {
    vi.mocked(api.calculate).mockImplementation(async (req) => ({
      results: req.ac_list.map((ac) => acResult({ ac }, req.attacks.length)),
    }));
  });

  it("sends the AC list and every attack row, in order", async () => {
    const user = userEvent.setup();
    render(<CalculatorPanel />);

    const acInput = screen.getByLabelText("Target AC(s), comma-separated");
    await user.clear(acInput);
    await user.type(acInput, " 14, ,16 ,");

    const name = within(row(1)).getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Greatsword");
    await user.click(within(row(1)).getByRole("button", { name: "Duplicate" }));
    await user.click(within(row(2)).getByLabelText("Power Attack (GWM/Sharpshooter)"));
    await user.click(screen.getByRole("button", { name: "Calculate" }));

    const req = vi.mocked(api.calculate).mock.calls[0][0];
    expect(req.ac_list).toEqual([14, 16]);
    expect(req.attacks).toEqual([
      newAttack({ name: "Greatsword" }),
      newAttack({ name: "Greatsword", power_attack: true }),
    ]);
  });

  it("shows grouped results for the attacks that were calculated", async () => {
    const user = userEvent.setup();
    render(<CalculatorPanel />);

    await user.click(screen.getByRole("button", { name: "+ Add attack" }));
    await user.click(within(row(2)).getByLabelText("Advantage"));
    await user.click(screen.getByRole("button", { name: "Calculate" }));

    // Two different attacks -> a column group each.
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader", { name: "Attack" })).toHaveLength(2);

    // Editing the rows afterwards doesn't relabel results that no longer match.
    await user.click(within(row(2)).getByRole("button", { name: "Remove" }));
    expect(screen.getAllByRole("columnheader", { name: "Attack" })).toHaveLength(2);
  });

  it("shows the API error and clears old results", async () => {
    const user = userEvent.setup();
    render(<CalculatorPanel />);
    await user.click(screen.getByRole("button", { name: "Calculate" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();

    vi.mocked(api.calculate).mockRejectedValue(new Error("422: Each AC must be between 1 and 30."));
    await user.click(screen.getByRole("button", { name: "Calculate" }));

    expect(await screen.findByText("422: Each AC must be between 1 and 30.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("disables the button while a request is in flight", async () => {
    const user = userEvent.setup();
    let resolve!: (v: { results: [] }) => void;
    vi.mocked(api.calculate).mockReturnValue(new Promise((r) => (resolve = r)));
    render(<CalculatorPanel />);

    await user.click(screen.getByRole("button", { name: "Calculate" }));
    expect(screen.getByRole("button", { name: "Calculating…" })).toBeDisabled();

    resolve({ results: [] });
    expect(await screen.findByRole("button", { name: "Calculate" })).toBeEnabled();
  });
});
