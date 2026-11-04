import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { weaponTable } from "../characters";
import { srdWeapons } from "../test/fixtures";
import type { CharacterSheet } from "../types";
import CharacterForm from "./CharacterForm";

const weapons = weaponTable(srdWeapons);

function setup(initial?: CharacterSheet) {
  const onSubmit = vi
    .fn<(sheet: CharacterSheet) => Promise<void>>()
    .mockResolvedValue();
  render(
    <CharacterForm
      weapons={weapons}
      initial={initial}
      submitLabel="Save character"
      onSubmit={onSubmit}
    />,
  );
  return { user: userEvent.setup(), onSubmit };
}

function hand(label: "Main hand" | "Off hand") {
  return screen.getByRole("group", { name: label });
}

async function submit(
  user: ReturnType<typeof userEvent.setup>,
  onSubmit: ReturnType<typeof setup>["onSubmit"],
) {
  await user.click(screen.getByRole("button", { name: "Save character" }));
  return onSubmit.mock.calls.at(-1)![0];
}

describe("CharacterForm", () => {
  it("saves a Fighter with a fighting style and subclass", async () => {
    const { user, onSubmit } = setup();
    await user.clear(screen.getByLabelText("Character name"));
    await user.type(screen.getByLabelText("Character name"), "Brakka");
    await user.clear(screen.getByLabelText("Level"));
    await user.type(screen.getByLabelText("Level"), "5");
    await user.selectOptions(
      within(hand("Main hand")).getByLabelText("Weapon"),
      "greatsword",
    );
    await user.selectOptions(
      screen.getByLabelText("Fighting style"),
      "great_weapon_fighting",
    );
    await user.selectOptions(screen.getByLabelText("Subclass"), "champion");

    const sheet = await submit(user, onSubmit);
    expect(sheet).toMatchObject({
      name: "Brakka",
      character_class: "fighter",
      level: 5,
      main_hand: { srd_weapon: "greatsword", proficient: true },
      fighting_style: "great_weapon_fighting",
      subclass: "champion",
    });
  });

  it("switching to Rogue clears Fighter-only options and rechecks proficiency", async () => {
    const { user, onSubmit } = setup();
    await user.selectOptions(
      screen.getByLabelText("Fighting style"),
      "dueling",
    );
    await user.selectOptions(
      within(hand("Main hand")).getByLabelText("Weapon"),
      "greatsword",
    );
    await user.selectOptions(screen.getByLabelText("Class"), "rogue");

    expect(screen.queryByLabelText("Fighting style")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Sneak Attack can trigger/)).toBeChecked();
    // Rogues aren't proficient with greatswords; picking a rapier is.
    expect(
      within(hand("Main hand")).getByLabelText("Proficient"),
    ).not.toBeChecked();
    await user.selectOptions(
      within(hand("Main hand")).getByLabelText("Weapon"),
      "rapier",
    );
    expect(
      within(hand("Main hand")).getByLabelText("Proficient"),
    ).toBeChecked();

    const sheet = await submit(user, onSubmit);
    expect(sheet).toMatchObject({
      character_class: "rogue",
      fighting_style: "none",
      subclass: "none",
    });
  });

  it("offers two hands only for versatile weapons, and an off hand only for light melee ones", async () => {
    const { user } = setup();
    // Longsword (versatile, not light): two hands yes, off hand no.
    expect(
      screen.getByLabelText("Wield in two hands (versatile)"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/Off-hand weapon/)).not.toBeInTheDocument();

    await user.selectOptions(
      within(hand("Main hand")).getByLabelText("Weapon"),
      "shortsword",
    );
    expect(
      screen.queryByLabelText("Wield in two hands (versatile)"),
    ).not.toBeInTheDocument();
    await user.click(screen.getByLabelText(/Off-hand weapon/));

    // The off-hand list only has light melee weapons.
    const offHandWeapons = within(
      within(hand("Off hand")).getByLabelText("Weapon"),
    )
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(offHandWeapons).toEqual([
      "Dagger (1d4)",
      "Scimitar (1d6)",
      "Shortsword (1d6)",
      "Custom…",
    ]);
  });

  it("drops the off-hand weapon when the main hand stops being light", async () => {
    const { user, onSubmit } = setup();
    await user.selectOptions(
      within(hand("Main hand")).getByLabelText("Weapon"),
      "shortsword",
    );
    await user.click(screen.getByLabelText(/Off-hand weapon/));
    await user.selectOptions(
      within(hand("Main hand")).getByLabelText("Weapon"),
      "rapier",
    );

    expect(
      screen.queryByRole("group", { name: "Off hand" }),
    ).not.toBeInTheDocument();
    expect((await submit(user, onSubmit)).off_hand).toBeNull();
  });

  it("edits a custom weapon", async () => {
    const { user, onSubmit } = setup();
    await user.selectOptions(
      within(hand("Main hand")).getByLabelText("Weapon"),
      "Custom…",
    );
    const main = hand("Main hand");
    await user.clear(within(main).getByLabelText("Weapon name"));
    await user.type(within(main).getByLabelText("Weapon name"), "Sun blade");
    await user.click(within(main).getByLabelText("Finesse"));
    await user.selectOptions(within(main).getByLabelText("Magic bonus"), "2");

    const sheet = await submit(user, onSubmit);
    expect(sheet.main_hand).toMatchObject({
      srd_weapon: null,
      magic_bonus: 2,
      custom: { name: "Sun blade", num_dice: 1, die_sides: 8, finesse: true },
    });
  });

  it("shows the server's error and keeps the form", async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(new Error("422: level: too high"));
    render(
      <CharacterForm
        weapons={weapons}
        submitLabel="Save character"
        onSubmit={onSubmit}
      />,
    );
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Save character" }));
    expect(await screen.findByText("422: level: too high")).toBeInTheDocument();
  });

  describe("Ability Score Improvements", () => {
    function asi(level: number) {
      return within(
        screen.getByRole("group", { name: "Ability Score Improvements" }),
      ).getByLabelText(new RegExp(`^Level ${level}( \\(planned\\))?$`));
    }

    it("shows the class's ASI levels and marks the ones above the current level as planned", async () => {
      const { user } = setup();
      const group = screen.getByRole("group", {
        name: "Ability Score Improvements",
      });
      const labels = () =>
        within(group)
          .getAllByRole("combobox")
          .map((c) => (c as HTMLSelectElement).labels?.[0]?.textContent);
      expect(labels()).toEqual([
        "Level 4 (planned)",
        "Level 6 (planned)",
        "Level 8 (planned)",
        "Level 12 (planned)",
        "Level 14 (planned)",
        "Level 16 (planned)",
        "Level 19 (planned)",
      ]);
      await user.clear(screen.getByLabelText("Level"));
      await user.type(screen.getByLabelText("Level"), "6");
      expect(labels().slice(0, 3)).toEqual([
        "Level 4",
        "Level 6",
        "Level 8 (planned)",
      ]);
    });

    it("previews the scores at the character's level and saves the choices", async () => {
      const { user, onSubmit } = setup();
      await user.clear(screen.getByLabelText("Level"));
      await user.type(screen.getByLabelText("Level"), "8");
      await user.selectOptions(asi(4), "strength_2");
      await user.selectOptions(asi(8), "elven_accuracy");
      // Starting STR 16 + 2, DEX 14 + 1.
      expect(
        screen.getByText("At level 8: STR 18, DEX 15"),
      ).toBeInTheDocument();

      const sheet = await submit(user, onSubmit);
      expect(sheet.ability_increases).toEqual([
        { level: 4, choice: "strength_2" },
        { level: 8, choice: "elven_accuracy" },
      ]);
    });

    it("offers each modeled feat once, and 'None yet' clears a choice", async () => {
      const { user, onSubmit } = setup();
      await user.selectOptions(asi(4), "power_attack_feat");
      const option = within(asi(6)).getByRole("option", {
        name: /Power attack feat/,
      });
      expect(option).toBeDisabled();
      expect(
        within(asi(6)).getByRole("option", { name: /Other feat/ }),
      ).toBeEnabled();

      await user.selectOptions(asi(4), "");
      expect(
        within(asi(6)).getByRole("option", { name: /Power attack feat/ }),
      ).toBeEnabled();
      expect((await submit(user, onSubmit)).ability_increases).toEqual([]);
    });

    it("drops choices at levels the new class doesn't get", async () => {
      const { user, onSubmit } = setup();
      await user.selectOptions(asi(4), "dexterity_2");
      await user.selectOptions(asi(6), "strength_2"); // Fighter-only level
      await user.selectOptions(screen.getByLabelText("Class"), "rogue");

      expect(
        within(
          screen.getByRole("group", { name: "Ability Score Improvements" }),
        ).queryByLabelText(/^Level 6/),
      ).not.toBeInTheDocument();
      expect(asi(10)).toHaveValue("");
      expect((await submit(user, onSubmit)).ability_increases).toEqual([
        { level: 4, choice: "dexterity_2" },
      ]);
    });
  });
});
