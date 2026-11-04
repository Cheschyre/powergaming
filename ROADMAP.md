# Roadmap

Where Power Gaming Calculator is headed, release by release, up to v1.0.0
and beyond. Agreed 2026-11-03; each release's details get settled before
its coding starts, the way step 13's first slice was.

## Direction

- **Audience: me and my table.** It stays self-hosted on the home lab,
  reached over Tailscale. No accounts or logins are planned; if that
  changes, accounts become their own release.
- **Scope beyond weapon attacks:** spells and saving throws, more classes
  on the character sheet, comparison and charts, and defense and
  encounters (monsters attacking you, rounds to defeat a monster, party
  damage).
- **Custom content:** the table plays with a supplemental rule set, so
  custom classes and subclasses are first-class -- kept separate from
  official (SRD) content and hidden unless "show custom content" is on.
- **Editions:** 2014 rules. 2024 rules aren't planned (bottom of "After
  1.0").
- **What 1.0 means:** the core of that scope is in, and it's stable.
  Saved builds and characters never break without a migration that
  carries them forward, the API doesn't change incompatibly within 1.x,
  data can be exported and re-imported, and there's a user guide. Bigger
  extras (multiclassing, probability distributions) come after 1.0.

## Principles

These held for steps 1-13 and keep holding:

- **The calculator stays generic.** Final numbers in, probabilities out,
  so it works for monsters, NPCs, homebrew and what-ifs nothing else
  models. Character sheets, spells and encounters build on the same
  engine; they never do probability math of their own.
- **Exact math, checked.** Expected values are computed exactly, and
  each new formula is tested against brute-force enumeration or a hand
  calculation.
- **Official content is SRD only**, with attribution. Anything else is
  user-entered: an effect toggle named for what it does ("roll 3d20 with
  advantage", not the feat's name), or custom content.
- **Official and custom stay separate.** Custom classes and subclasses
  are stored and labelled as custom, and only appear in lists when "show
  custom content" is on.
- **Every release goes test -> prod.** Developed on `develop`, deployed
  to `powergaming-test`, released to `powergaming-prod` from a version
  tag on `main`, with a database backup before every migration.

## Releases to 1.0

Each line is a release. Version numbers are a plan, not a promise: a
release can split if it grows.

### v0.7.0 -- Character sheet, second slice -- done

Details agreed 2026-11-03; built as agreed.

- **Ability scores by level, like a real sheet.** The sheet's STR and DEX
  become *starting* scores (level 1). At each Ability Score Improvement
  level -- Fighter 4, 6, 8, 12, 14, 16, 19; Rogue 4, 8, 10, 12, 16, 19 --
  the character records one choice:
  - +2 STR, +2 DEX, or +1 STR / +1 DEX (an ASI can't raise a score above
    20);
  - **Elven Accuracy** (+1 DEX; attacks using DEX roll 3d20 when they
    have advantage -- 2014 rule: DEX or a mental ability, never STR);
  - **Power attack feat** (Great Weapon Master / Sharpshooter style:
    the round's power-attack toggle only applies from this level on);
  - another feat (no score change).
  Scores at any level are the starting scores plus the choices up to it;
  the character's current scores follow from its level. Future ASIs can
  be planned ahead. Choices at levels the class doesn't get are dropped
  when the class changes.
- **Existing characters keep their numbers:** their scores become the
  starting scores with no increases recorded, and with no power attack
  feat recorded the toggle keeps applying at every level, as today. No
  database migration (the sheet is JSON).
- **Level view:** a "Levels 1-20" button on each character card opens
  a table (one row per level) and a line chart of damage per round,
  against **up to 3 target ACs** (default 13, 15, 17; editable). The
  card's round toggles apply at every level. With power attack on, a
  dashed "without power attack" line shows where it stops paying off.
  Rows note what changes there: "Extra Attack", "Sneak Attack 4d6",
  "Improved Critical", "+2 DEX", "Elven Accuracy", ...
- **Server-side:** the level view is the existing derivation run at each
  level (`POST /api/characters/{id}/levels` and an unsaved-sheet
  version), so every number matches the normal Run at that level.
- **Charts: Recharts**, used here first and reused by v0.8.
- Already on `develop`: number fields can be cleared without a 0
  appearing.

Built in four parts: (1) backend -- ASI choices, feats, level derivation
and endpoints; (2) the sheet's ASI editor; (3) the level view with
Recharts, loaded on first open so the main bundle stays small; (4) README
and the release.

### v0.8.0 -- Comparison and charts

Details agreed 2026-11-04.

- **A Compare tab.** Pick up to **4 entries** -- any mix of saved builds
  and saved characters -- and see their damage per round side by side
  against a range of ACs (**default 10-25**, editable within 1-30).
  - Each character entry has its own round toggles (advantage,
    disadvantage, power attack), so the same character can appear twice,
    e.g. power attack on vs off. Characters run at their own level.
  - A line chart (one line per entry, direct end labels, legend, hover
    tooltip; same palette rules and on-demand loading as v0.7's chart)
    and a table with every value, marking the best entry at each AC.
  - Not saved on the server: the last selection is remembered in the
    browser.
- **Power-attack breakeven for characters**, for the whole round: power
  attack "pays off" at an AC when the round with it (-5/+10 on the
  attacks that can use it) deals at least as much as the same round
  without it, using the round's other toggles. The breakeven is the
  highest AC (1-30) where it still pays off.
  - **On the character card**, with power attack ticked: "Power attack
    pays off against AC 17 or lower" -- or that it pays off at every AC,
    never pays off, or doesn't apply (no heavy or ranged weapon, or the
    feat isn't taken yet at this level).
  - **In the level view:** a "Power attack pays off up to AC" column for
    every level 1-20.
  - Computed on the server alongside the existing results.

Build order: (1) backend -- the breakeven on character results and level
rows; (2) breakeven on the card and in the level view; (3) the Compare
tab; (4) README and the release.

### v0.9.0 -- Martial classes

Classes become data: each class and subclass is a level-by-level table
of what it adds (attacks per round, crit range, extra damage dice,
fighting styles, ...), and the sheet derives attacks from those tables.
The SRD classes below are the built-in tables, written in the same
format v0.10's custom classes will use. Fighter and Rogue move onto it
first, with their numbers unchanged (checked by the existing tests).

- **Barbarian:** Rage damage by level, Reckless Attack (advantage),
  Brutal Critical (extra crit dice, step 12).
- **Paladin:** Divine Smite as a choice per round (slot level), Improved
  Divine Smite at 11, fighting styles.
- **Ranger:** fighting styles, Extra Attack, Hunter's Colossus Slayer
  (once per turn, step 11).
- **Monk:** Martial Arts die by level, bonus-action unarmed strike and
  Flurry of Blows.
- **Burst turns:** a "nova turn" toggle for once-in-a-while features
  (Action Surge first), shown next to the normal round rather than mixed
  into it.
- **Races (SRD):** the ones that change attack numbers, e.g. Half-Orc
  Savage Attacks.

### v0.10.0 -- Custom classes and subclasses

- **Create and edit custom classes and subclasses** in the app, using
  v0.9's class format: features by level, picked from what the engine
  models (extra attacks, crit range, once-per-turn dice, rage-style
  flat damage, extra crit dice, rerolls, fighting styles, ...), plus a
  flat "other" bonus for anything not modeled.
- **Custom subclasses for official classes** too (e.g. a supplemental
  Fighter subclass).
- **"Show custom content" toggle:** off by default; when off, custom
  classes and subclasses don't appear in the sheet's lists. Characters
  using custom content are marked as such.
- Stored in their own table, labelled custom, included in v1.0's
  export/import.
- Spell-based features for custom classes come with v0.12's casters.

### v0.11.0 -- Spells, part 1: the engine

- **Attack-roll spells** in the calculator: they're attacks with spell
  attack bonus and dice, so they mostly reuse the engine; cantrip
  scaling by character level (Fire Bolt's dice, Eldritch Blast's beams).
- **Saving-throw damage:** save DC against the target's save bonus, full
  damage on a failure, half (or none) on a success. Results get a
  "target save bonus" axis next to AC.
- **Area spells:** expected damage across N targets, each saving
  separately.

### v0.12.0 -- Spells, part 2: casters on the sheet

- Classes whose damage is mostly spells: Warlock (Eldritch Blast,
  Agonizing Blast), Sorcerer and Wizard (cantrips, a few signature
  damage spells from the SRD by slot level), Cleric (Sacred Flame,
  Spiritual Weapon-style turns).
- Spellcasting ability, spell attack bonus and save DC derived from the
  sheet.
- Paladin smites move onto spell slots here.
- Custom classes and subclasses can use spellcasting features too.

### v0.13.0 -- Defense and encounters

- **Monsters:** a simple stat block (AC, hit points, save bonuses, its
  attacks), entered by hand. Monsters use the same attack engine.
- **Defense:** a monster's expected damage per round against a
  character's AC (and saves), and rounds until the character drops.
- **Encounters:** a party of saved characters against one monster:
  party damage per round and expected rounds to defeat it.
- Expected values only here; full probability distributions (chance to
  kill within N rounds) come after 1.0.

### v1.0.0 -- Stable

- **Data safety:** export all builds, characters, monsters and custom
  content to a JSON
  file and import them back (also a way to copy data between test and
  prod).
- **Compatibility promise:** within 1.x, every schema change comes with a
  migration that carries saved data forward, and API changes are
  additions only.
- **User guide:** how each tab works and what the numbers mean, in the
  app or as a page in the repo.
- **Polish pass:** phone layout, keyboard and screen-reader use, error
  messages, empty states.
- **Release pipeline:** promote the exact images that passed on test to
  prod instead of rebuilding from the tag (see "Known gaps").

## After 1.0

Not scheduled yet, in order of interest:

- **Probability distributions:** not just expected damage but the
  chance of at least X damage, or of defeating a monster within N
  rounds.
- **Multiclassing**, then the remaining classes and subclasses.
- More feats and races as effect toggles; resources across a day
  (short rests, spell slots over several fights).
- Sharing a build or character as a link or file.
- **2024 rules** -- not currently planned; last on this list. If it ever
  happens, it's an edition choice on the sheet (e.g. 2024 Great Weapon
  Master adds proficiency with no -5; Sharpshooter lost its -5/+10). The
  generic calculator already handles both editions through free
  numbers.

## Known gaps

Not features, but worth tracking:

- **Prod rebuilds images from the tag** rather than promoting the exact
  `:develop` images test ran. Fine while they're built from the same
  commit; scheduled for v1.0.
- **No auth** on any endpoint. Anyone who can reach the API can read,
  edit or delete any build or character. Acceptable for a self-hosted
  tool for one table on Tailscale; revisit only if the audience changes.

## History: steps 1-13

How the app got here, in the original step numbering. Step 13's "later
slices" are now planned in the releases above.

1. ~~Backend API wrapping the existing logic~~ -- done.
2. ~~Postgres + Alembic migrations, saved builds~~ -- done.
3. ~~Frontend (React + TypeScript + Vite)~~ -- done.
4. ~~Test suites~~ -- done. Backend `pytest` (API, builds CRUD,
   calculator, CORS) and, as of step 8, a frontend Vitest suite; both
   run in CI.
5. ~~GitHub Actions CI~~ -- done. Runs backend `pytest` and a
   frontend type-check + build on every push and PR, to every branch.
   Linting, frontend tests and an API-types check were added in step 8.
6. ~~Stand up a `powergaming-test` stack on the home lab~~ -- done and
   verified end-to-end. Every push to `develop` builds `:develop` images,
   pushes them to GHCR, joins the tailnet, uploads the compose file and
   redeploys `/opt/powergaming-test` on docker-host
   (http://100.104.100.109:8081, API on `:8001`). The frontend has a real
   Dockerfile (Vite build served by nginx, proxying `/api/*` to the
   backend container).
7. ~~Stand up `powergaming-prod`~~ -- done and verified end-to-end with
   the first release, `v0.1.0`. Same docker-host and compose file as
   test, but its own directory, database volume and ports
   (`/opt/powergaming-prod`, http://100.104.100.109:8082, API on
   `:8002`). Both stacks deploy through the reusable `deploy-stack.yml`;
   `cd-prod.yml` runs it for version tags (`v1.2.3`) on `main`, and the
   deploy waits for approval in the `production` GitHub Environment. See
   "Releasing to prod" in `deploy/README.md`.
8. ~~Pay down engineering debt~~ -- done, before step 9 adds more
   surface area to carry it across:
   - Linting: `ruff` (lint + format) for the backend, ESLint for the
     frontend, both enforced in `ci.yml`. See "Linting" above.
   - `requirements.txt` is runtime-only (what the image ships);
     `requirements-dev.txt` adds test/lint tooling.
   - `frontend/src/types.ts` is now aliases over `api-schema.ts`, generated
     from the backend's OpenAPI schema by `scripts/gen-api-types.sh`; CI
     fails if it's stale. See "Changing an API request/response model".
   - CORS: `allow_origins=["*"]` replaced by `CORS_ALLOW_ORIGINS` --
     the Vite dev server by default, off entirely in the deployed stacks
     (same-origin through nginx).
   - Migrations run once per deploy from `deploy/remote-deploy.sh`, after
     an automatic `pg_dump` (newest 10 kept per stack), instead of on
     every container start. See "Database: migrations and backups" in
     `deploy/README.md`.
   - Frontend test suite: Vitest + React Testing Library, run in CI.
   - Also: the frontend builds on Node 24 (Node 20 is end-of-life), and
     GitHub Actions are on their Node 24 versions.
9. ~~Multiple distinct attacks per round~~ -- done. A round is now a
   list of attack entries (repeat one for Extra Attack), each with its
   own bonus, damage, crit range, advantage and power-attack toggle.
   - `CalculateRequest`/builds take `attacks: [...]`; results return
     per-attack numbers plus a server-computed round total and the
     round's total without power attack.
   - Migration `0002` turned every saved build into `num_attacks`
     identical entries -- same numbers as before (verified against the
     old API on real data).
   - UI: repeatable attack rows with Duplicate/Remove; the results table
     stays compact when all attacks match and groups identical attacks
     ("Greatsword (PA) ×2 | Handaxe") when they differ.
10. ~~Edit saved builds~~ -- done (v0.3.1). Each saved build has an Edit
    button that opens the same name + attack-row form, prefilled -- also
    how builds converted by migration `0002` get real weapon names
    instead of "Attack". (Character level, proficiency and the level
    view moved to step 13: they belong to a character, not to the
    generic calculator.)
11. ~~Once-per-turn extra damage (Sneak Attack and similar)~~ -- done.
    A round can carry one named rider (dice + flat bonus), and each attack
    has an "eligible" checkbox for it.
    - Engine: added to the first eligible attack that hits, in list
      order; a crit on that hit doubles the rider's dice. Exact, not
      simulated: the sum over eligible attacks of P(all earlier eligible
      ones missed) x that attack's hit/crit-weighted rider damage
      (checked in tests against all 400 d20 pairs).
    - Results: the rider gets its own damage column (it isn't per
      attack), plus a "chance it lands" column when 2+ attacks are
      eligible (with one, that's just its Hit%). The round total includes
      it, and the without-power-attack comparison recomputes it at the
      higher hit chances.
    - Saved builds store it (migration `0003`, a nullable column -- existing
      builds are unchanged).
    - Generic on purpose: step 13 can map Sneak Attack, Divine Smite-style
      riders, Hunter's Mark-like once-per-turn bonuses etc. onto it.
    - Also: nginx now sends `Cache-Control: no-cache` for `index.html`
      (hashed `/assets/` are cached for good), so a new release shows up
      without a hard refresh.
12. ~~More attack options in the engine~~ -- done, each a per-attack
    setting named for what it does (all exact, checked against brute-force
    enumeration in tests):
    - **Roll 3d20 with advantage** (Elven Accuracy): highest of three
      d20s, only when the attack has advantage.
    - **Extra dice on a crit** (Savage Attacks, Brutal Critical, Piercer's
      crit bonus).
    - **Reroll damage dice at or below N** (2014 Great Weapon Fighting is
      N = 2), applied to every weapon die including crit dice.
    - The breakeven finder takes all three too.
    - Not modeled, by choice: "treat low dice as N" (2024 Great Weapon
      Fighting, Elemental Adept) and Piercer's once-per-turn reroll of one
      die (about +1 damage). Slasher/Crusher are mostly non-damage
      effects. Crossbow Expert needs nothing new: the bonus-action shot is
      just another attack entry.
    - No migration: the options live in each attack's JSON and default to
      off for existing builds.
13. Mini character sheet -- enter a character instead of final numbers.
    First slice done; later slices below.
    The sheet *derives* attack entries (bonus, dice, modifier, options)
    on the server and runs them through the same engine, so it never does
    probability math itself and every engine feature (steps 9-12) works
    for it automatically.

    **First slice -- done (2014 rules):**
    - Single class: **Fighter** or **Rogue**, level 1-20 (proficiency
      derived: +2 at 1-4 up to +6 at 17-20).
    - Inputs: name, class, level, STR and DEX scores, a main-hand weapon
      and an optional off-hand weapon, "two hands" for versatile weapons,
      +N magic bonus and a "proficient" checkbox per weapon (set from the
      class -- 2014 Rogues: simple weapons plus hand crossbows,
      longswords, rapiers, shortswords -- and editable),
      plus manual "other to-hit" / "other damage" bonuses for anything
      not modeled.
    - Weapons: the 2014 SRD weapons table (dice and properties: finesse,
      light, heavy, two-handed, versatile, ranged), plus a custom weapon.
      Finesse uses the better of STR/DEX; ranged uses DEX.
    - Fighter: Extra Attack (2 attacks at 5, 3 at 11, 4 at 20); subclass
      Champion (crit 19-20 from 3, 18-20 from 15) or Other; one fighting
      style: Archery (+2 to hit, ranged), Dueling (+2 damage, one
      one-handed melee weapon and no other weapon), Great Weapon Fighting
      (reroll 1-2s on two-handed/versatile-in-two-hands, step 12), or
      Two-Weapon Fighting (ability modifier on the off-hand attack).
    - Rogue: Sneak Attack, ceil(level / 2) d6, on finesse or ranged
      attacks (step 11), with a "Sneak Attack can trigger" checkbox
      (default on) standing in for advantage or an adjacent ally.
    - Two light weapons add the bonus-action off-hand attack as its own
      row. Per RAW it adds the ability modifier to damage only if that
      modifier is negative, or with the Two-Weapon Fighting style. For a
      Rogue it's a second chance at Sneak Attack.
    - Round toggles, set when calculating rather than stored on the
      character: advantage, disadvantage, and power attack (-5 to hit /
      +10 damage on heavy melee or ranged weapons -- an effect toggle,
      since the feats that grant it aren't in the SRD).
    - Output: the usual results table plus the derived attack rows, so
      the numbers can be checked.
    - Characters get their own table (migration) with save/edit/delete
      like builds, and "Save as build" to compare a snapshot.
    - SRD 5.1 attribution (CC-BY-4.0) in the README and the app footer.
    - Left out on purpose: Action Surge (skews a per-round average),
      races, multiclassing, other classes and subclass features, and the
      3d20-advantage toggle (see below).

    **Later slices:** the level-by-level view (rebuild the attacks at each
    level -- proficiency, ability score increases, Extra Attack, Sneak
    Attack dice -- and show hit/crit/HAD and the power-attack breakeven
    across 1-20); more classes (Barbarian, Paladin, Ranger, Monk) and
    features (Action Surge, Rage, smites); races (e.g. Half-Orc Savage
    Attacks via extra crit dice); an Elven Accuracy option on the sheet
    ("roll 3d20 with advantage", stored on the character since it's a
    feat -- the engine has supported it since step 12, it just isn't
    exposed on characters yet); a 2024 ruleset option (e.g. 2024 Great
    Weapon Master adds proficiency with no -5, and Sharpshooter lost its
    -5/+10) -- the generic calculator already handles both editions via
    free numbers.

The calculator itself stays generic -- final numbers in, probabilities
out -- so it remains useful for quick what-ifs, monsters, NPCs and
homebrew that no character sheet models.

Spell-save damage (Fireball, Chromatic Orb, etc.) is intentionally not
on this list yet -- the app is attack-roll-only today, and steps 11-12
round that out fully before any save-based mechanics get added.
