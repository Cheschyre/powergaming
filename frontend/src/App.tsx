import { useState } from "react";
import BreakevenPanel from "./components/BreakevenPanel";
import BuildsPanel from "./components/BuildsPanel";
import CalculatorPanel from "./components/CalculatorPanel";

type Tab = "calculator" | "breakeven" | "builds";

export default function App() {
  const [tab, setTab] = useState<Tab>("calculator");

  return (
    <div className="app">
      <header>
        <h1>Power Gaming Calculator</h1>
        <nav className="tabs">
          <button
            className={tab === "calculator" ? "active" : ""}
            onClick={() => setTab("calculator")}
          >
            Calculator
          </button>
          <button
            className={tab === "breakeven" ? "active" : ""}
            onClick={() => setTab("breakeven")}
          >
            Breakeven
          </button>
          <button className={tab === "builds" ? "active" : ""} onClick={() => setTab("builds")}>
            Saved Builds
          </button>
        </nav>
      </header>

      <main>
        {tab === "calculator" && <CalculatorPanel />}
        {tab === "breakeven" && <BreakevenPanel />}
        {tab === "builds" && <BuildsPanel />}
      </main>
    </div>
  );
}
