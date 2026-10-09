import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api";
import { acResult } from "../test/fixtures";
import CalculatorPanel from "./CalculatorPanel";

vi.mock("../api");

describe("CalculatorPanel", () => {
  beforeEach(() => {
    vi.mocked(api.calculate).mockResolvedValue({ results: [acResult({ ac: 15 })] });
  });

  it("sends the form as a calculate request and shows the results", async () => {
    const user = userEvent.setup();
    render(<CalculatorPanel />);

    const acInput = screen.getByLabelText("Target AC(s), comma-separated");
    await user.clear(acInput);
    await user.type(acInput, " 14, ,16 ,");
    await user.clear(screen.getByLabelText("Attack bonus"));
    await user.type(screen.getByLabelText("Attack bonus"), "9");
    await user.click(screen.getByLabelText("Advantage"));
    await user.click(screen.getByRole("button", { name: "Calculate" }));

    expect(api.calculate).toHaveBeenCalledWith({
      attack_bonus: 9,
      ac_list: [14, 16],
      num_dice: 1,
      die_sides: 8,
      modifier: 3,
      num_attacks: 1,
      advantage: true,
      disadvantage: false,
      crit_range: 20,
      power_attack: false,
      power_attack_bonus: 10,
      power_attack_penalty: -5,
    });
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "15" })).toBeInTheDocument();
  });

  it("only shows the power-attack inputs while Power Attack is checked", async () => {
    const user = userEvent.setup();
    render(<CalculatorPanel />);

    expect(screen.queryByLabelText("Power attack bonus damage")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Power Attack (GWM/Sharpshooter)"));
    expect(screen.getByLabelText("Power attack bonus damage")).toHaveValue(10);
    expect(screen.getByLabelText("Power attack hit penalty")).toHaveValue(-5);
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
