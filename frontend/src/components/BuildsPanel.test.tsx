import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api";
import { acResult, build, greatsword, handaxe } from "../test/fixtures";
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

  it("lists saved builds with their attacks grouped", async () => {
    vi.mocked(api.listBuilds).mockResolvedValue([
      build({ attacks: [{ ...greatsword, power_attack: true }, { ...greatsword, power_attack: true }, handaxe] }),
      build({ id: 2, name: "Archer", attacks: [{ ...handaxe, name: "Longbow", advantage: true }] }),
    ]);
    render(<BuildsPanel />);

    await screen.findByText("Greatsword fighter");
    const fighterLines = within(card("Greatsword fighter")).getAllByRole("listitem").map((li) => li.textContent);
    expect(fighterLines).toEqual(["Greatsword (PA) ×2: +8, 2d6+5, PA +10/−5", "Handaxe: +8, 1d6"]);
    expect(within(card("Archer")).getByRole("listitem")).toHaveTextContent("Longbow: +8, 1d6, adv");
  });

  it("shows a load error", async () => {
    vi.mocked(api.listBuilds).mockRejectedValue(new Error("502: Bad Gateway"));
    render(<BuildsPanel />);
    expect(await screen.findByText("502: Bad Gateway")).toBeInTheDocument();
    expect(screen.queryByText("No builds saved yet.")).not.toBeInTheDocument();
  });

  it("saves a new build with all its attacks, resets the form and refreshes", async () => {
    const user = userEvent.setup();
    vi.mocked(api.createBuild).mockResolvedValue(build({ id: 9, name: "Rogue" }));
    render(<BuildsPanel />);
    await screen.findByText("No builds saved yet.");

    await user.clear(screen.getByLabelText("Build name"));
    await user.type(screen.getByLabelText("Build name"), "Rogue");
    await user.click(screen.getByRole("button", { name: "Duplicate" }));
    vi.mocked(api.listBuilds).mockResolvedValue([build({ id: 9, name: "Rogue" })]);
    await user.click(screen.getByRole("button", { name: "Save build" }));

    const saved = vi.mocked(api.createBuild).mock.calls[0][0];
    expect(saved.name).toBe("Rogue");
    expect(saved.attacks).toHaveLength(2);
    expect(await screen.findByText("Rogue")).toBeInTheDocument();
    expect(screen.getByLabelText("Build name")).toHaveValue("New Build");
    expect(screen.getAllByRole("group", { name: /^Attack \d+$/ })).toHaveLength(1);
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
    vi.mocked(api.calculateForBuild).mockResolvedValue({ results: [acResult({ ac: 17 }, 2)] });
    render(<BuildsPanel />);
    await screen.findByText("Fighter");

    const archer = card("Archer");
    const acInput = within(archer).getByLabelText("Target ACs for Archer");
    await user.clear(acInput);
    await user.type(acInput, "17, 19");
    await user.click(within(archer).getByRole("button", { name: "Run" }));

    expect(api.calculateForBuild).toHaveBeenCalledWith(2, [17, 19]);
    const table = await within(archer).findByRole("table");
    // Labelled with the build's own attacks.
    expect(within(table).getByText("Greatsword ×2")).toBeInTheDocument();
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

  it("summarizes once-per-turn damage and passes it to the results", async () => {
    const user = userEvent.setup();
    const rapier = { ...handaxe, name: "Rapier", once_per_turn_eligible: true };
    const sneak = { name: "Sneak Attack", num_dice: 3, die_sides: 6, modifier: 0 };
    vi.mocked(api.listBuilds).mockResolvedValue([
      build({ name: "Rogue", attacks: [rapier], once_per_turn: sneak }),
    ]);
    vi.mocked(api.calculateForBuild).mockResolvedValue({
      results: [acResult({ once_per_turn: { chance: 0.65, had: 7.35 } })],
    });
    render(<BuildsPanel />);
    await screen.findByText("Rogue");

    expect(card("Rogue")).toHaveTextContent(
      "Sneak Attack: 3d6 once per turn, on the first hit by Rapier",
    );
    await user.click(within(card("Rogue")).getByRole("button", { name: "Run" }));
    expect(
      await within(card("Rogue")).findByRole("columnheader", { name: "Sneak Attack damage" }),
    ).toBeInTheDocument();

    // The edit form starts from the saved rider.
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const editor = screen.getByRole("heading", { name: /^Editing/ }).parentElement!;
    expect(within(editor).getByLabelText(/Once-per-turn extra damage/)).toBeChecked();
    expect(within(editor).getByLabelText("Eligible for Sneak Attack")).toBeChecked();
  });

  describe("editing", () => {
    it("opens the build in an editor, prefilled with its name and attacks", async () => {
      const user = userEvent.setup();
      vi.mocked(api.listBuilds).mockResolvedValue([build({ attacks: [greatsword, handaxe] })]);
      render(<BuildsPanel />);
      await screen.findByText("Greatsword fighter");

      await user.click(within(card("Greatsword fighter")).getByRole("button", { name: "Edit" }));

      const editor = screen.getByRole("heading", { name: "Editing Greatsword fighter" }).parentElement!;
      expect(within(editor).getByLabelText("Build name")).toHaveValue("Greatsword fighter");
      const rows = within(editor).getAllByRole("group", { name: /^Attack \d+$/ });
      expect(rows.map((r) => within(r).getByLabelText("Name"))).toHaveLength(2);
      expect(within(rows[1]).getByLabelText("Name")).toHaveValue("Handaxe");
    });

    it("saves name and attack changes, then shows the updated build", async () => {
      const user = userEvent.setup();
      vi.mocked(api.listBuilds).mockResolvedValue([build({ attacks: [greatsword] })]);
      vi.mocked(api.updateBuild).mockResolvedValue(build());
      render(<BuildsPanel />);
      await screen.findByText("Greatsword fighter");

      await user.click(screen.getByRole("button", { name: "Edit" }));
      const editor = screen.getByRole("heading", { name: /^Editing/ }).parentElement!;
      await user.clear(within(editor).getByLabelText("Build name"));
      await user.type(within(editor).getByLabelText("Build name"), "Champion");
      await user.click(within(editor).getByRole("button", { name: "Duplicate" }));
      vi.mocked(api.listBuilds).mockResolvedValue([
        build({ name: "Champion", attacks: [greatsword, greatsword] }),
      ]);
      await user.click(within(editor).getByRole("button", { name: "Save changes" }));

      expect(api.updateBuild).toHaveBeenCalledWith(1, {
        name: "Champion",
        attacks: [greatsword, greatsword],
        once_per_turn: null,
      });
      expect(await screen.findByText("Champion")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: /^Editing/ })).not.toBeInTheDocument();
      expect(within(card("Champion")).getByRole("listitem")).toHaveTextContent("Greatsword ×2");
    });

    it("cancel discards changes without calling the API", async () => {
      const user = userEvent.setup();
      vi.mocked(api.listBuilds).mockResolvedValue([build()]);
      render(<BuildsPanel />);
      await screen.findByText("Greatsword fighter");

      await user.click(screen.getByRole("button", { name: "Edit" }));
      await user.type(screen.getAllByLabelText("Build name")[0], " II");
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(api.updateBuild).not.toHaveBeenCalled();
      expect(screen.getByText("Greatsword fighter")).toBeInTheDocument();
      // Re-opening starts from the saved build again, not the discarded edit.
      await user.click(screen.getByRole("button", { name: "Edit" }));
      expect(screen.getAllByLabelText("Build name")[0]).toHaveValue("Greatsword fighter");
    });

    it("keeps the editor open and shows the error when saving fails", async () => {
      const user = userEvent.setup();
      vi.mocked(api.listBuilds).mockResolvedValue([build()]);
      vi.mocked(api.updateBuild).mockRejectedValue(new Error("422: name too long"));
      render(<BuildsPanel />);
      await screen.findByText("Greatsword fighter");

      await user.click(screen.getByRole("button", { name: "Edit" }));
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByText("422: name too long")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /^Editing/ })).toBeInTheDocument();
    });

    it("drops results from before the edit", async () => {
      const user = userEvent.setup();
      vi.mocked(api.listBuilds).mockResolvedValue([build()]);
      vi.mocked(api.calculateForBuild).mockResolvedValue({ results: [acResult({}, 2)] });
      vi.mocked(api.updateBuild).mockResolvedValue(build());
      render(<BuildsPanel />);
      await screen.findByText("Greatsword fighter");

      await user.click(screen.getByRole("button", { name: "Run" }));
      expect(await screen.findByRole("table")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Edit" }));
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await screen.findByRole("button", { name: "Edit" });
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
  });
});
