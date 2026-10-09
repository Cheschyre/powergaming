import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_ATTACKS } from "../attacks";
import { greatsword, handaxe } from "../test/fixtures";
import type { AttackEntry } from "../types";
import AttackListEditor from "./AttackListEditor";

const changed = vi.fn<(attacks: AttackEntry[]) => void>();

/** The attack list after the most recent edit. */
function latest(): AttackEntry[] {
  return changed.mock.lastCall![0];
}

function Harness({ initial }: { initial: AttackEntry[] }) {
  const [attacks, setAttacks] = useState(initial);
  return (
    <AttackListEditor
      attacks={attacks}
      onChange={(next) => {
        changed(next);
        setAttacks(next);
      }}
    />
  );
}

function row(n: number) {
  return screen.getByRole("group", { name: `Attack ${n}` });
}

describe("AttackListEditor", () => {
  beforeEach(() => changed.mockClear());

  it("edits one attack without touching the others", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[greatsword, handaxe]} />);

    const bonus = within(row(2)).getByLabelText("Attack bonus");
    await user.clear(bonus);
    await user.type(bonus, "6");
    await user.click(within(row(1)).getByLabelText("Power Attack (GWM/Sharpshooter)"));

    expect(latest()[1].attack_bonus).toBe(6);
    expect(latest()[0].attack_bonus).toBe(8);
    expect(latest()[0].power_attack).toBe(true);
    expect(latest()[1].power_attack).toBe(false);
  });

  it("shows power-attack numbers only on attacks using it", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[greatsword, handaxe]} />);

    await user.click(within(row(1)).getByLabelText("Power Attack (GWM/Sharpshooter)"));

    expect(within(row(1)).getByLabelText("Power attack bonus damage")).toHaveValue(10);
    expect(within(row(2)).queryByLabelText("Power attack bonus damage")).not.toBeInTheDocument();
  });

  it("duplicates a row right after itself (Extra Attack)", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[greatsword, handaxe]} />);

    await user.click(within(row(1)).getByRole("button", { name: "Duplicate" }));

    expect(latest().map((a) => a.name)).toEqual(["Greatsword", "Greatsword", "Handaxe"]);
    expect(latest()[1]).toEqual(latest()[0]);
    expect(latest()[1]).not.toBe(latest()[0]); // a copy, not the same object
  });

  it("adds a default attack and removes rows, but never the last one", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[greatsword]} />);

    expect(within(row(1)).getByRole("button", { name: "Remove" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "+ Add attack" }));
    expect(latest().map((a) => a.name)).toEqual(["Greatsword", "Attack"]);

    await user.click(within(row(1)).getByRole("button", { name: "Remove" }));
    expect(latest().map((a) => a.name)).toEqual(["Attack"]);
  });

  it("stops adding at the API's maximum", () => {
    render(<Harness initial={Array.from({ length: MAX_ATTACKS }, () => handaxe)} />);
    expect(screen.getByRole("button", { name: "+ Add attack" })).toBeDisabled();
    expect(within(row(1)).getByRole("button", { name: "Duplicate" })).toBeDisabled();
  });
});
