import { useEffect, useState } from "react";
import {
  createCharacter,
  deleteCharacter,
  listCharacters,
  listSrdWeapons,
  replaceCharacter,
} from "../api";
import { toSheet, weaponTable, type WeaponTable } from "../characters";
import type { Character, CharacterSheet } from "../types";
import CharacterCard from "./CharacterCard";
import CharacterForm from "./CharacterForm";

/** Saved characters (roadmap step 13): enter a character instead of final
 * numbers, and the server derives its attacks. */
export default function CharactersPanel() {
  const [weapons, setWeapons] = useState<WeaponTable | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  async function refresh() {
    try {
      setCharacters(await listCharacters());
      setLoadError(null);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Couldn't load characters.",
      );
    }
  }

  useEffect(() => {
    async function load() {
      try {
        setWeapons(weaponTable(await listSrdWeapons()));
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : "Couldn't load weapons.",
        );
        return;
      }
      await refresh();
    }
    load();
  }, []);

  async function handleCreate(sheet: CharacterSheet) {
    await createCharacter(sheet);
    await refresh();
  }

  async function handleSaveEdit(id: number, sheet: CharacterSheet) {
    await replaceCharacter(id, sheet);
    setEditingId(null);
    await refresh();
  }

  async function handleDelete(id: number) {
    await deleteCharacter(id);
    await refresh();
  }

  return (
    <section>
      <h2>Characters</h2>
      <p className="hint">
        2014 rules, Fighter or Rogue. Enter the character and its attacks are
        worked out for you -- proficiency, Extra Attack, fighting style, Sneak
        Attack.
      </p>
      {loadError && <p className="error">{loadError}</p>}
      {!weapons && !loadError && <p>Loading…</p>}
      {weapons && (
        <>
          {characters.length === 0 && !loadError && (
            <p>No characters saved yet.</p>
          )}
          {characters.map((character) =>
            editingId === character.id ? (
              <div className="build-card editing" key={character.id}>
                <h3>Editing {character.name}</h3>
                <CharacterForm
                  weapons={weapons}
                  initial={toSheet(character)}
                  submitLabel="Save changes"
                  onSubmit={(sheet) => handleSaveEdit(character.id, sheet)}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            ) : (
              <CharacterCard
                // A new key after each save resets the card's old results.
                key={`${character.id}-${character.updated_at}`}
                character={character}
                weapons={weapons}
                onEdit={() => setEditingId(character.id)}
                onDelete={() => handleDelete(character.id)}
              />
            ),
          )}

          <h3>Create a character</h3>
          <CharacterForm
            weapons={weapons}
            submitLabel="Save character"
            onSubmit={handleCreate}
            resetOnSuccess
          />
        </>
      )}
    </section>
  );
}
