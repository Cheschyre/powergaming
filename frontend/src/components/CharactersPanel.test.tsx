import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api";
import { newAttack } from "../attacks";
import { acResult, build, character, srdWeapons } from "../test/fixtures";
import CharactersPanel from "./CharactersPanel";

vi.mock("../api");

function card(name: string) {
  return screen
    .getByText(name, { selector: "strong" })
    .closest(".build-card") as HTMLElement;
}

const derived = {
  attacks: [
    newAttack({
      name: "Shortsword",
      attack_bonus: 6,
      num_dice: 1,
      die_sides: 6,
      modifier: 3,
      once_per_turn_eligible: true,
    }),
    newAttack({
      name: "Dagger (off-hand)",
      attack_bonus: 6,
      num_dice: 1,
      die_sides: 4,
      modifier: 0,
      once_per_turn_eligible: true,
    }),
  ],
  once_per_turn: {
    name: "Sneak Attack",
    num_dice: 3,
    die_sides: 6,
    modifier: 0,
  },
};

describe("CharactersPanel", () => {
  beforeEach(() => {
    vi.mocked(api.listSrdWeapons).mockResolvedValue(srdWeapons);
    vi.mocked(api.listCharacters).mockResolvedValue([character()]);
  });

  it("lists saved characters with a summary", async () => {
    render(<CharactersPanel />);
    expect(await screen.findByText("Vex")).toBeInTheDocument();
    expect(card("Vex")).toHaveTextContent(
      "Level 5 Rogue · Shortsword + Dagger · STR 10, DEX 16",
    );
  });

  it("runs a character with this round's toggles and shows its derived attacks", async () => {
    vi.mocked(api.calculateForCharacter).mockResolvedValue({
      ...derived,
      results: [acResult({ once_per_turn: { chance: 0.8775, had: 9.56 } }, 2)],
    });
    const user = userEvent.setup();
    render(<CharactersPanel />);
    await screen.findByText("Vex");

    await user.click(within(card("Vex")).getByLabelText("Advantage"));
    await user.click(within(card("Vex")).getByRole("button", { name: "Run" }));

    expect(api.calculateForCharacter).toHaveBeenCalledWith(1, [12, 15, 18], {
      advantage: true,
      disadvantage: false,
      power_attack: false,
    });
    const rows = await within(card("Vex")).findByRole("list", {
      name: "Derived attacks",
    });
    expect(rows).toHaveTextContent("Shortsword: +6, 1d6+3");
    expect(rows).toHaveTextContent("Dagger (off-hand): +6, 1d4");
    expect(rows).toHaveTextContent("Sneak Attack: 3d6 once per turn");
    // Two different weapons -> the grouped table; two eligible attacks ->
    // a chance column under the Sneak Attack heading.
    expect(
      within(card("Vex")).getByRole("columnheader", { name: "Sneak Attack" }),
    ).toHaveAttribute("colspan", "2");
  });

  it("saves the character's round as a build", async () => {
    vi.mocked(api.saveCharacterAsBuild).mockResolvedValue(
      build({ name: "Vex (level 5)" }),
    );
    const user = userEvent.setup();
    render(<CharactersPanel />);
    await screen.findByText("Vex");

    await user.click(
      within(card("Vex")).getByRole("button", { name: "Save as build" }),
    );

    expect(api.saveCharacterAsBuild).toHaveBeenCalledWith(1, {
      advantage: false,
      disadvantage: false,
      power_attack: false,
    });
    expect(
      await screen.findByText(/Saved as build “Vex \(level 5\)”/),
    ).toBeInTheDocument();
  });

  it("creates, edits and deletes characters", async () => {
    vi.mocked(api.listCharacters).mockResolvedValue([]);
    vi.mocked(api.createCharacter).mockResolvedValue(character());
    vi.mocked(api.replaceCharacter).mockResolvedValue(character());
    vi.mocked(api.deleteCharacter).mockResolvedValue();
    const user = userEvent.setup();
    render(<CharactersPanel />);
    expect(
      await screen.findByText("No characters saved yet."),
    ).toBeInTheDocument();

    vi.mocked(api.listCharacters).mockResolvedValue([character()]);
    await user.click(screen.getByRole("button", { name: "Save character" }));
    expect(api.createCharacter).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New character" }),
    );
    await screen.findByText("Vex");

    await user.click(within(card("Vex")).getByRole("button", { name: "Edit" }));
    const editor = screen.getByRole("heading", {
      name: "Editing Vex",
    }).parentElement!;
    expect(within(editor).getByLabelText("Class")).toHaveValue("rogue");
    await user.clear(within(editor).getByLabelText("Level"));
    await user.type(within(editor).getByLabelText("Level"), "6");
    await user.click(
      within(editor).getByRole("button", { name: "Save changes" }),
    );
    expect(api.replaceCharacter).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        level: 6,
        off_hand: expect.objectContaining({ srd_weapon: "dagger" }),
      }),
    );
    expect(vi.mocked(api.replaceCharacter).mock.calls[0][1]).not.toHaveProperty(
      "id",
    );

    vi.mocked(api.listCharacters).mockResolvedValue([]);
    await user.click(
      within(card("Vex")).getByRole("button", { name: "Delete" }),
    );
    expect(api.deleteCharacter).toHaveBeenCalledWith(1);
    expect(
      await screen.findByText("No characters saved yet."),
    ).toBeInTheDocument();
  });

  it("shows a load error", async () => {
    vi.mocked(api.listSrdWeapons).mockRejectedValue(
      new Error("502: Bad Gateway"),
    );
    render(<CharactersPanel />);
    expect(await screen.findByText("502: Bad Gateway")).toBeInTheDocument();
  });
});
