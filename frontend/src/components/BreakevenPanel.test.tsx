import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as api from "../api";
import BreakevenPanel from "./BreakevenPanel";

vi.mock("../api");

describe("BreakevenPanel", () => {
  it("requests the breakeven scan and marks crossovers and the better option", async () => {
    vi.mocked(api.breakeven).mockResolvedValue({
      rows: [
        { ac: 14, normal_had: 7, power_had: 9 },
        { ac: 15, normal_had: 7, power_had: 7 },
        { ac: 16, normal_had: 6, power_had: 5 },
      ],
      crossovers: [15],
    });
    const user = userEvent.setup();
    render(<BreakevenPanel />);

    await user.click(screen.getByRole("button", { name: "Find Breakeven" }));

    expect(api.breakeven).toHaveBeenCalledWith(
      expect.objectContaining({ attack_bonus: 8, die_sides: 12, ac_min: 1, ac_max: 30 }),
    );
    expect(await screen.findByText("Crossover AC(s): 15")).toBeInTheDocument();
    const [power, tied, normal] = screen.getAllByRole("row").slice(1);
    expect(within(power).getAllByRole("cell")[3]).toHaveTextContent("Power");
    expect(within(tied).getAllByRole("cell")[3]).toHaveTextContent("Tied");
    expect(within(normal).getAllByRole("cell")[3]).toHaveTextContent("Normal");
    expect(tied).toHaveClass("crossover-row");
    expect(power).not.toHaveClass("crossover-row");
  });

  it("says so when there's no crossover in range", async () => {
    vi.mocked(api.breakeven).mockResolvedValue({
      rows: [{ ac: 10, normal_had: 5, power_had: 8 }],
      crossovers: [],
    });
    const user = userEvent.setup();
    render(<BreakevenPanel />);

    await user.click(screen.getByRole("button", { name: "Find Breakeven" }));

    expect(await screen.findByText(/No crossover in this AC range/)).toBeInTheDocument();
  });

  it("shows the API error", async () => {
    vi.mocked(api.breakeven).mockRejectedValue(
      new Error("422: ac_max must be greater than or equal to ac_min."),
    );
    const user = userEvent.setup();
    render(<BreakevenPanel />);

    await user.click(screen.getByRole("button", { name: "Find Breakeven" }));

    expect(await screen.findByText(/ac_max must be greater/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
