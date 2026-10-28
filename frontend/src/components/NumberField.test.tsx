import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import NumberField from "./NumberField";

const changed = vi.fn();

function Harness({ initial = 5 }: { initial?: number }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <NumberField
        label="Attack bonus"
        value={value}
        onChange={(v) => {
          changed(v);
          setValue(v);
        }}
      />
      <button onClick={() => setValue(9)}>Reset to 9</button>
      <output>{value}</output>
    </>
  );
}

function field() {
  return screen.getByLabelText("Attack bonus");
}

describe("NumberField", () => {
  it("can be cleared without a 0 appearing, then takes the new number", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.clear(field());
    expect(field()).toHaveValue(null); // empty, not 0
    expect(changed).not.toHaveBeenCalled();

    await user.type(field(), "12");
    expect(field()).toHaveValue(12);
    expect(changed).toHaveBeenLastCalledWith(12);
    expect(screen.getByRole("status")).toHaveTextContent("12");
  });

  it("puts the last number back if left empty", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.clear(field());
    await user.tab();
    expect(field()).toHaveValue(5);
  });

  it("accepts negative numbers typed from scratch", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.clear(field());
    await user.type(field(), "-5");
    expect(changed).toHaveBeenLastCalledWith(-5);
    expect(field()).toHaveValue(-5);
  });

  it("follows value changes made by the parent", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Reset to 9" }));
    expect(field()).toHaveValue(9);
  });

  it("is required, so a form can't submit while it's empty", () => {
    render(<Harness />);
    expect(field()).toBeRequired();
  });
});
