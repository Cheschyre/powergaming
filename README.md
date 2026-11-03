# Power Gaming Calculator

![CI](https://github.com/Cheschyre/powergaming/actions/workflows/ci.yml/badge.svg)

D&D 5e attack/damage probability calculator — hit chance, crit chance, and
hit-adjusted damage (HAD), with advantage/disadvantage, expanded crit
ranges, once-per-turn extra damage (Sneak Attack and similar), extra crit
dice, rerolled damage dice, 3d20 advantage, and a GWM/Sharpshooter-style
power attack breakeven finder. Builds
can be saved and re-run against new target ACs without re-entering every
field, and characters (2014 Fighter or Rogue) can be entered as a mini
character sheet that works out their attacks for you.

The original CLI script is now a full app with a versioned
frontend/backend, a test environment, and a production environment on
the home lab. What's next is in [ROADMAP.md](ROADMAP.md).

## Structure

```
powergaming/
├── backend/
│   ├── app/
│   │   ├── calculator.py    # pure math -- ported from the original CLI script
│   │   ├── service.py       # glue between calculator.py and the API schemas
│   │   ├── schemas.py       # Pydantic request/response models
│   │   ├── models.py        # SQLAlchemy ORM models (`builds`, `characters`)
│   │   ├── db.py            # DB engine/session setup
│   │   ├── crud.py          # database read/write functions
│   │   ├── character.py     # character sheet -> attack entries (2014 rules)
│   │   ├── srd.py           # SRD 5.1 weapons table (CC-BY-4.0, see below)
│   │   ├── main.py          # FastAPI app, /api/calculate, /api/breakeven
│   │   └── routers/
│   │       ├── builds.py      # /api/builds CRUD + per-build calculate
│   │       └── characters.py  # /api/characters, /api/srd/weapons
│   ├── alembic/              # database migrations
│   │   ├── env.py
│   │   └── versions/
│   │       └── 0001_... 0004_...  # one file per schema change
│   ├── alembic.ini
│   ├── tests/
│   │   ├── conftest.py           # shared test DB fixture (in-memory SQLite)
│   │   ├── test_calculator.py    # unit tests on the math
│   │   ├── test_api.py           # integration tests on /api/calculate, /api/breakeven
│   │   ├── test_builds_api.py    # integration tests on /api/builds
│   │   ├── test_character.py     # character rules, hand-calculated
│   │   ├── test_characters_api.py  # /api/characters CRUD, save as build
│   │   └── test_migrations.py    # Alembic upgrades/downgrades with data
│   ├── requirements.txt       # runtime deps (what the API image installs)
│   ├── requirements-dev.txt   # + test/lint tooling, for CI and local dev
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api-schema.ts      # GENERATED from backend/app/schemas.py (scripts/gen-api-types.sh)
│   │   ├── types.ts           # friendly names for the generated API types
│   │   ├── api.ts             # fetch wrapper, one function per endpoint
│   │   ├── App.tsx            # tab switcher
│   │   ├── characters.ts      # character sheet helpers (defaults, proficiency)
│   │   └── components/        # CalculatorPanel, BuildsPanel, CharactersPanel, ...
│   ├── vite.config.ts
│   └── package.json
├── .github/
│   └── workflows/
│       ├── ci.yml             # runs backend tests + frontend build on every push
│       ├── deploy-stack.yml   # reusable: build/push images + deploy one stack to docker-host
│       ├── cd-test.yml        # push to develop -> powergaming-test
│       └── cd-prod.yml        # version tag on main -> powergaming-prod
├── deploy/
│   ├── docker-compose.yml     # the home-lab stack, shared by test and prod (pulls images, no bind mounts)
│   ├── remote-deploy.sh       # runs on docker-host per deploy: backup, migrate, restart
│   ├── .env.example           # template for each stack's .env on the VM
│   └── README.md              # releasing, rollback, and one-time setup (VM, secrets, Tailscale)
├── scripts/
│   └── gen-api-types.sh       # regenerate frontend API types from the backend schemas
├── docker-compose.yml        # LOCAL DEV ONLY, not the home-lab deployment
├── ROADMAP.md                # planned releases to 1.0 and beyond, plus history
├── .env.example               # copy to .env to override DB credentials locally
└── .gitignore
```

`calculator.py` is deliberately dependency-free and I/O-free — it's the
same logic as the original `PowerGaming.py`, just without the `input()`
prompts. `service.py` wraps it for the API layer, and both `main.py` and
`routers/builds.py` call into that shared function instead of duplicating
the same loop. Keeping the math isolated is what makes it independently
testable and reusable from two different endpoints.

## Running locally

With Docker (this now also starts a Postgres container and applies
migrations automatically before the server starts):

```bash
docker compose up --build
```

Then hit `http://localhost:8000/health` or open `http://localhost:8000/docs`
for the interactive Swagger UI FastAPI generates automatically.

Without Docker, you'll need your own Postgres running and a `DATABASE_URL`
environment variable pointing at it, then:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend

In a separate terminal, with the backend already running:

```bash
cd frontend
npm install
npm run dev
```

Opens on `http://localhost:5173` and talks to the API on `:8000`. See
`frontend/README.md` for more detail.

### Making a schema change later

Edit `app/models.py`, then generate a new migration and apply it:

```bash
cd backend
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

Always read the auto-generated migration file before running it --
autogenerate is a good first draft, not a guarantee, especially for
renames or data migrations.

### Changing an API request/response model

The frontend's TypeScript types are generated from the Pydantic models in
`backend/app/schemas.py`, so after changing one, regenerate them:

```bash
scripts/gen-api-types.sh   # needs backend + frontend deps installed
```

That rewrites `frontend/openapi.json` and `frontend/src/api-schema.ts`;
commit both. CI's "API types in sync" job fails if they're stale.

## Running tests

Backend tests use an in-memory SQLite database (see `tests/conftest.py`),
so they don't need a real Postgres running:

```bash
cd backend
pip install -r requirements-dev.txt
pytest -v
```

Frontend tests use Vitest + React Testing Library in jsdom, with the API
module mocked, so they don't need the backend running:

```bash
cd frontend
npm test              # or `npm run test:watch` while developing
```

Tests live next to the code they cover (`src/**/*.test.ts(x)`); shared
setup and fixtures are in `src/test/`.

## Linting

CI fails on any lint or formatting problem, so run these before pushing:

```bash
cd backend
ruff check .            # add --fix to apply safe fixes
ruff format .           # CI runs `ruff format --check .`

cd ../frontend
npm run lint            # ESLint; fails on warnings too
```

Ruff is configured in `backend/pyproject.toml`, ESLint in
`frontend/eslint.config.js`.

## API

### `POST /api/calculate`

Computes hit chance, crit chance and HAD for a **round of attacks** across
a list of target ACs. A round is a list of attack entries -- repeat an
entry for Extra Attack. Each entry has its own power-attack
(GWM/Sharpshooter) toggle, so you can power-attack with one swing and not
another:

```json
{
  "ac_list": [12, 15, 18],
  "attacks": [
    {"name": "Greatsword", "attack_bonus": 8, "num_dice": 2, "die_sides": 6, "modifier": 5,
     "power_attack": true, "power_attack_bonus": 10, "power_attack_penalty": -5},
    {"name": "Greatsword", "attack_bonus": 8, "num_dice": 2, "die_sides": 6, "modifier": 5},
    {"name": "Handaxe", "attack_bonus": 8, "num_dice": 1, "die_sides": 6}
  ]
}
```

Optional per-entry fields and defaults: `name` ("Attack"), `modifier` (0),
`crit_range` (20), `advantage` / `disadvantage` (false), `power_attack`
(false), `power_attack_bonus` / `power_attack_penalty` (0),
`once_per_turn_eligible` (false), and these attack options (also taken
by `/api/breakeven`):

- `super_advantage` (false) -- advantage rolls three d20s and keeps the
  best (Elven Accuracy). Ignored unless the attack has advantage (and not
  also disadvantage).
- `extra_crit_dice` (0, up to 10) -- that many more weapon dice on a crit,
  on top of the doubled ones (Savage Attacks, Brutal Critical, Piercer).
- `reroll_at_or_below` (0 = off) -- a weapon damage die showing this or
  lower is rerolled once and the new roll kept (2014 Great Weapon
  Fighting: 2). Must be below `die_sides`. Applies to crit dice too, not
  to once-per-turn damage.

1-20 entries per round.

Optional **once-per-turn damage** (Sneak Attack, smite-style riders):

```json
"once_per_turn": {"name": "Sneak Attack", "num_dice": 3, "die_sides": 6, "modifier": 0}
```

It's added once, to the first attack marked `once_per_turn_eligible` that
hits, in list order; if that hit is a crit its dice are doubled (the flat
`modifier` isn't). At least one entry must be eligible (`422` otherwise).

Each result row has `attacks` (per-attack `hit_chance`, `crit_chance`,
`had`, in request order), `once_per_turn` (`chance` it lands and its
expected damage `had`, or `null`), the round's `total_had`, and
`total_had_without_power_attack` -- the same round with every power attack
switched off, once-per-turn damage recomputed to match, for comparison
(`null` if no entry uses power attack). Use the API's `total_had` rather
than summing entries: once-per-turn damage makes it more than a plain sum.

### `POST /api/breakeven`

Scans AC 1-30 (or a narrower range via `ac_min`/`ac_max`) and returns the
normal vs. power-attack HAD at each AC, plus the AC(s) where the better
option switches.

```json
{
  "attack_bonus": 8,
  "num_dice": 1,
  "die_sides": 12,
  "modifier": 3,
  "power_attack_bonus": 10,
  "power_attack_penalty": -5
}
```

### `GET /health`

Basic liveness check.

### `POST /api/builds`

Save a round of attacks: `{"name": "...", "attacks": [...],
"once_per_turn": {...}}`, with `attacks` and the optional `once_per_turn`
in the same shape as `/api/calculate`. Returns the saved build
including its `id`.

### `GET /api/builds`

List all saved builds.

### `GET /api/builds/{id}`

Fetch one saved build. `404` if it doesn't exist.

### `PATCH /api/builds/{id}`

Partially update a saved build -- send only what changes (`name`,
`attacks`, `once_per_turn`); `attacks` replaces the whole list and
`"once_per_turn": null` removes it. The resulting build is validated as a
whole, e.g. new `attacks` with none eligible for the stored
`once_per_turn` are a `422`.

### `DELETE /api/builds/{id}`

Delete a saved build. Returns `204 No Content`.

### `POST /api/builds/{id}/calculate`

Run a saved build's stored attacks against a list of ACs, without
re-sending them:

```json
{ "ac_list": [12, 15, 18] }
```

Response shape is identical to `/api/calculate`.

### Characters (2014 rules, Fighter or Rogue)

A character sheet is what a player enters; the server derives the round's
attacks from it (`app/character.py`):

```json
{
  "name": "Vex", "character_class": "rogue", "level": 5,
  "strength": 10, "dexterity": 16,
  "main_hand": {"srd_weapon": "shortsword"},
  "off_hand": {"srd_weapon": "dagger"}
}
```

Optional: `two_handed_grip` (versatile weapons), `fighting_style`
(Fighter: `archery`, `dueling`, `great_weapon_fighting`,
`two_weapon_fighting`), `subclass` (Fighter: `champion`),
`sneak_attack_can_trigger` (Rogue, default true), `other_to_hit`,
`other_damage`. A weapon is `{"srd_weapon": key}` or `{"custom": {name,
num_dice, die_sides, versatile_die_sides, finesse, light, heavy,
two_handed, ranged}}`, plus `magic_bonus` (0-3) and `proficient`
(default true). Combinations the rules don't allow (two-weapon fighting
without light melee weapons, a two-handed grip with an off-hand weapon, a
Rogue fighting style, ...) are a `422` with a readable message.

Round toggles, sent alongside rather than stored: `{"advantage",
"disadvantage", "power_attack"}` (power attack only applies to heavy
melee or ranged weapons).

- `GET /api/srd/weapons` -- the SRD weapons table (35 weapons).
- `POST /api/characters/derive` `{character, toggles}` -- the derived
  `attacks` and `once_per_turn` (Sneak Attack), in `/api/calculate`'s
  shape.
- `POST /api/characters/calculate` `{character, toggles, ac_list}` --
  derive and calculate in one go: `attacks`, `once_per_turn`, `results`.
- `POST /api/characters`, `GET /api/characters`,
  `GET/PUT/DELETE /api/characters/{id}` -- saved characters. `PUT`
  replaces the whole sheet (its rules span fields, so it's validated as
  one unit).
- `POST /api/characters/{id}/calculate` `{ac_list, toggles}`.
- `POST /api/characters/{id}/save-as-build` `{name?, toggles}` -- saves
  the derived round as a build (default name "Vex (level 5)"); a
  snapshot that later character edits don't change.

## Roadmap

See [ROADMAP.md](ROADMAP.md): the direction (self-hosted for one table,
no accounts, 2014 rules), what 1.0 means, and the planned releases --
the character sheet's level view (v0.7), comparison and charts (v0.8),
martial classes as data (v0.9), custom classes and subclasses (v0.10),
spells and saving throws (v0.11-v0.12), defense and encounters (v0.13),
then a stable 1.0. It also keeps the history of steps 1-13.

## Attribution

This work includes material taken from the System Reference Document 5.1
("SRD 5.1") by Wizards of the Coast LLC and available at
https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1
is licensed under the Creative Commons Attribution 4.0 International
License available at https://creativecommons.org/licenses/by/4.0/legalcode.

Used here: the 2014 weapons table (`backend/app/srd.py`) and the class
rules the character sheet derives attacks from (`backend/app/character.py`).
The app shows the same notice in its footer.
