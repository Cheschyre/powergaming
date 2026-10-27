import { useState } from "react";
import BreakevenPanel from "./components/BreakevenPanel";
import BuildsPanel from "./components/BuildsPanel";
import CalculatorPanel from "./components/CalculatorPanel";
import CharactersPanel from "./components/CharactersPanel";

type Tab = "calculator" | "breakeven" | "builds" | "characters";

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
          <button
            className={tab === "characters" ? "active" : ""}
            onClick={() => setTab("characters")}
          >
            Characters
          </button>
        </nav>
      </header>

      <main>
        {tab === "calculator" && <CalculatorPanel />}
        {tab === "breakeven" && <BreakevenPanel />}
        {tab === "builds" && <BuildsPanel />}
        {tab === "characters" && <CharactersPanel />}
      </main>

      <footer className="attribution">
        This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”)
        by Wizards of the Coast LLC, available at{" "}
        <a href="https://dnd.wizards.com/resources/systems-reference-document">
          dnd.wizards.com/resources/systems-reference-document
        </a>
        . The SRD 5.1 is licensed under the{" "}
        <a href="https://creativecommons.org/licenses/by/4.0/legalcode">
          Creative Commons Attribution 4.0 International License
        </a>
        .
      </footer>
    </div>
  );
}
