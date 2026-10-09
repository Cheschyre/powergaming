import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api";
import { acResult, build } from "../test/fixtures";
import BuildsPanel from "./BuildsPanel";

vi.mock("../api");

function card(name: string) {
  return screen.getByText(name).closest(".build-card") as HTMLElement;
}

describe("BuildsPanel", () => {
  beforeEach(() => {
    vi.mocked(api.listBuilds).mockResolvedValue([]);
  });

  it("shows the empty state when there are no builds", async () => {
    render(<BuildsPanel />);
    expect(await screen.findByText("No builds saved yet.")).toBeInTheDocument();
  });

  it("lists saved builds with a readable summary", async () => {
    vi.mocked(api.listBuilds).mockResolvedValue([
      build(),
      build({ id: 2, name: "Archer", num_attacks: 1, power_attack: false }),
    ]);
    render(<BuildsPanel />);

    await screen.findByText("Greatsword fighter");
    expect(within(card("Greatsword fighter")).getByText(/\+7 attack, 2d6\+4/)).toHaveTextContent(
      "+7 attack, 2d6+4 damage, 2 attacks/round – power attack: +10 dmg / -5 to hit",
    );
    expect(within(card("Archer")).getByText(/attack\/round$/)).toHaveTextContent(
      "1 attack/round",
    );
  });

  it("shows a load error", async () => {
    vi.mocked(api.listBuilds).mockRejectedValue(new Error("502: Bad Gateway"));
    render(<BuildsPanel />);
    expect(await screen.findByText("502: Bad Gateway")).toBeInTheDocument();
    expect(screen.queryByText("No builds saved yet.")).not.toBeInTheDocument();
  });

  it("saves a new build, resets the name and refreshes the list", async () => {
    const user = userEvent.setup();
    vi.mocked(api.createBuild).mockResolvedValue(build({ id: 9, name: "Rogue" }));
    render(<BuildsPanel />);
    await screen.findByText("No builds saved yet.");

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Rogue");
    vi.mocked(api.listBuilds).mockResolvedValue([build({ id: 9, name: "Rogue" })]);
    await user.click(screen.getByRole("button", { name: "Save build" }));

    expect(api.createBuild).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Rogue", attack_bonus: 5, num_attacks: 1 }),
    );
    expect(await screen.findByText("Rogue")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("New Build");
  });

  it("shows a save error and keeps the form", async () => {
    const user = userEvent.setup();
    vi.mocked(api.createBuild).mockRejectedValue(new Error("422: name too long"));
    render(<BuildsPanel />);
    await screen.findByText("No builds saved yet.");

    await user.click(screen.getByRole("button", { name: "Save build" }));

    expect(await screen.findByText("422: name too long")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save build" })).toBeEnabled();
  });

  it("deletes a build and refreshes", async () => {
    const user = userEvent.setup();
    vi.mocked(api.listBuilds).mockResolvedValue([build()]);
    vi.mocked(api.deleteBuild).mockResolvedValue(undefined);
    render(<BuildsPanel />);
    await screen.findByText("Greatsword fighter");

    vi.mocked(api.listBuilds).mockResolvedValue([]);
    await user.click(within(card("Greatsword fighter")).getByRole("button", { name: "Delete" }));

    expect(api.deleteBuild).toHaveBeenCalledWith(1);
    expect(await screen.findByText("No builds saved yet.")).toBeInTheDocument();
  });

  it("runs each build against its own AC list and keeps results per build", async () => {
    const user = userEvent.setup();
    vi.mocked(api.listBuilds).mockResolvedValue([
      build({ id: 1, name: "Fighter" }),
      build({ id: 2, name: "Archer" }),
    ]);
    vi.mocked(api.calculateForBuild).mockResolvedValue({ results: [acResult({ ac: 17 })] });
    render(<BuildsPanel />);
    await screen.findByText("Fighter");

    const archer = card("Archer");
    const acInput = within(archer).getByPlaceholderText("Target AC(s), comma-separated");
    await user.clear(acInput);
    await user.type(acInput, "17, 19");
    await user.click(within(archer).getByRole("button", { name: "Run" }));

    expect(api.calculateForBuild).toHaveBeenCalledWith(2, [17, 19]);
    expect(await within(archer).findByRole("table")).toBeInTheDocument();
    expect(within(card("Fighter")).queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows a run error on that build only", async () => {
    const user = userEvent.setup();
    vi.mocked(api.listBuilds).mockResolvedValue([build()]);
    vi.mocked(api.calculateForBuild).mockRejectedValue(new Error("404: Build not found"));
    render(<BuildsPanel />);
    await screen.findByText("Greatsword fighter");

    await user.click(screen.getByRole("button", { name: "Run" }));

    expect(
      await within(card("Greatsword fighter")).findByText("404: Build not found"),
    ).toBeInTheDocument();
  });
});
