import { useState } from "react";
import { calculateForCharacter, saveCharacterAsBuild } from "../api";
import {
  describeAttack,
  describeOncePerTurn,
  groupAttacks,
  groupLabel,
  parseAcList,
} from "../attacks";
import {
  describeCharacter,
  describeWeapons,
  type WeaponTable,
} from "../characters";
import type {
  Character,
  CharacterCalculateResponse,
  RoundToggles,
} from "../types";
import CheckboxField from "./CheckboxField";
import ResultsTable from "./ResultsTable";

interface CharacterCardProps {
  character: Character;
  weapons: WeaponTable;
  onEdit: () => void;
  onDelete: () => void;
}

const NO_TOGGLES: RoundToggles = {
  advantage: false,
  disadvantage: false,
  power_attack: false,
};

/** A saved character: summary, this round's toggles, its derived attacks
 * and results, and "Save as build". */
export default function CharacterCard({
  character,
  weapons,
  onEdit,
  onDelete,
}: CharacterCardProps) {
  const [acText, setAcText] = useState("12, 15, 18");
  const [toggles, setToggles] = useState<RoundToggles>(NO_TOGGLES);
  const [calculated, setCalculated] =
    useState<CharacterCalculateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  function toggle(changes: Partial<RoundToggles>) {
    setToggles((prev) => ({ ...prev, ...changes }));
  }

  async function run() {
    setError(null);
    try {
      setCalculated(
        await calculateForCharacter(character.id, parseAcList(acText), toggles),
      );
    } catch (err) {
      setCalculated(null);
      setError(
        err instanceof Error ? err.message : "Couldn't run this character.",
      );
    }
  }

  async function saveAsBuild() {
    setError(null);
    setSaved(null);
    try {
      const build = await saveCharacterAsBuild(character.id, toggles);
      setSaved(`Saved as build “${build.name}” -- see Saved Builds.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't save as a build.",
      );
    }
  }

  return (
    <div className="build-card character-card">
      <div className="build-card-header">
        <strong>{character.name}</strong>
        <div className="build-card-actions">
          <button onClick={onEdit}>Edit</button>
          <button onClick={onDelete} className="danger">
            Delete
          </button>
        </div>
      </div>
      <p className="build-summary">
        {describeCharacter(character)} · {describeWeapons(character, weapons)} ·
        STR {character.strength}, DEX {character.dexterity}
      </p>

      <div className="field-grid round-toggles">
        <CheckboxField
          label="Advantage"
          checked={toggles.advantage}
          onChange={(v) => toggle({ advantage: v })}
        />
        <CheckboxField
          label="Disadvantage"
          checked={toggles.disadvantage}
          onChange={(v) => toggle({ disadvantage: v })}
        />
        <CheckboxField
          label="Power attack (−5/+10, heavy or ranged)"
          checked={toggles.power_attack}
          onChange={(v) => toggle({ power_attack: v })}
        />
      </div>
      <div className="run-row">
        <input
          value={acText}
          onChange={(e) => setAcText(e.target.value)}
          placeholder="Target AC(s), comma-separated"
          aria-label={`Target ACs for ${character.name}`}
        />
        <button onClick={run}>Run</button>
        <button className="secondary" onClick={saveAsBuild}>
          Save as build
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {saved && <p className="notice">{saved}</p>}
      {calculated && (
        <>
          <ul
            className="build-summary derived-attacks"
            aria-label="Derived attacks"
          >
            {groupAttacks(calculated.attacks).map((g) => (
              <li key={g.indices[0]}>
                <span className="attack-name">{groupLabel(g)}</span>:{" "}
                {describeAttack(g.attack)}
              </li>
            ))}
            {calculated.once_per_turn && (
              <li>
                <span className="attack-name">
                  {calculated.once_per_turn.name}
                </span>
                : {describeOncePerTurn(calculated.once_per_turn)} once per turn
              </li>
            )}
          </ul>
          <ResultsTable
            results={calculated.results}
            attacks={calculated.attacks}
            oncePerTurn={calculated.once_per_turn}
          />
        </>
      )}
    </div>
  );
}
