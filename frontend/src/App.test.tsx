import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as api from "./api";
import App from "./App";

vi.mock("./api");

describe("App", () => {
  it("starts on the calculator and switches tabs", async () => {
    vi.mocked(api.listBuilds).mockResolvedValue([]);
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole("button", { name: "Calculate" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Breakeven" }));
    expect(screen.getByRole("button", { name: "Find Breakeven" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Calculate" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Saved Builds" }));
    expect(await screen.findByText("No builds saved yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saved Builds" })).toHaveClass("active");
  });
});
