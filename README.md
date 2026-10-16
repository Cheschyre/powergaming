# Power Gaming Calculator

![CI](https://github.com/Cheschyre/powergaming/actions/workflows/ci.yml/badge.svg)

D&D 5e attack/damage probability calculator — hit chance, crit chance, and
hit-adjusted damage (HAD), with advantage/disadvantage, expanded crit
ranges, and a GWM/Sharpshooter-style power attack breakeven finder. Builds
can be saved and re-run against new target ACs without re-entering every
field, and there's now a browser UI on top of the API.

The original CLI script is now a full app with a versioned
frontend/backend, a test environment, and a production environment on
the home lab (steps 1-8 of the roadmap below are done; step 9 is next).

## Structure

```
powergaming/
├── backend/
│   ├── app/
│   │   ├── calculator.py    # pure math -- ported from the original CLI script
│   │   ├── service.py       # glue between calculator.py and the API schemas
│   │   ├── schemas.py       # Pydantic request/response models
│   │   ├── models.py        # SQLAlchemy ORM models (the `builds` table)
│   │   ├── db.py            # DB engine/session setup
│   │   ├── crud.py          # database read/write functions
│   │   ├── main.py          # FastAPI app, /api/calculate, /api/breakeven
│   │   └── routers/
│   │       └── builds.py    # /api/builds CRUD + per-build calculate
│   ├── alembic/              # database migrations
│   │   ├── env.py
│   │   └── versions/
│   │       └── 0001_create_builds_table.py
│   ├── alembic.ini
│   ├── tests/
│   │   ├── conftest.py           # shared test DB fixture (in-memory SQLite)
│   │   ├── test_calculator.py    # unit tests on the math
│   │   ├── test_api.py           # integration tests on /api/calculate, /api/breakeven
│   │   └── test_builds_api.py    # integration tests on /api/builds
│   ├── requirements.txt       # runtime deps (what the API image installs)
│   ├── requirements-dev.txt   # + test/lint tooling, for CI and local dev
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api-schema.ts      # GENERATED from backend/app/schemas.py (scripts/gen-api-types.sh)
│   │   ├── types.ts           # friendly names for the generated API types
│   │   ├── api.ts             # fetch wrapper, one function per endpoint
│   │   ├── App.tsx            # tab switcher
│   │   └── components/        # CalculatorPanel, BreakevenPanel, BuildsPanel, ...
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
(false), `power_attack_bonus` / `power_attack_penalty` (0). 1-20 entries
per round.

Each result row has `attacks` (per-attack `hit_chance`, `crit_chance`,
`had`, in request order), the round's `total_had`, and
`total_had_without_power_attack` -- the same round with every power attack
switched off, for comparison (`null` if no entry uses power attack). Use
the API's `total_had` rather than summing entries: once-per-turn effects
(Sneak Attack, roadmap step 11) make it more than a plain sum.

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

Save a round of attacks: `{"name": "...", "attacks": [...]}`, with
`attacks` in the same shape as `/api/calculate`. Returns the saved build
including its `id`.

### `GET /api/builds`

List all saved builds.

### `GET /api/builds/{id}`

Fetch one saved build. `404` if it doesn't exist.

### `PATCH /api/builds/{id}`

Partially update a saved build -- send only `name` and/or `attacks`;
`attacks` replaces the whole list.

### `DELETE /api/builds/{id}`

Delete a saved build. Returns `204 No Content`.

### `POST /api/builds/{id}/calculate`

Run a saved build's stored attacks against a list of ACs, without
re-sending them:

```json
{ "ac_list": [12, 15, 18] }
```

Response shape is identical to `/api/calculate`.

## Project roadmap

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
10. Level/progression view -- add `character_level` (1-20) and
    auto-derive proficiency bonus from it (+2 through +6 at the
    standard breakpoints), shown across a level range alongside
    hit/crit/HAD and the power-attack breakeven. `attack_bonus` stays
    the one field it is today (not split into stat mod / proficiency /
    item bonus) -- revisit that split if/when lite saved-character
    sheets happen, where it'd actually pay for itself instead of just
    reassembling into the same number.
11. Sneak Attack (once-per-turn bonus damage) -- depends on step 9,
    since "once per turn" only means something once attacks are
    tracked individually. Applies to whichever attack the user
    designates, not auto-assigned to the first one that would land.
12. Other feats:
    - Crossbow Expert (bonus-action off-hand shot without the usual
      penalty) -- mostly falls out of step 9's multi-attack model once
      that exists.
    - Elven Accuracy (reroll one of two advantage dice) -- needs a new
      "super-advantage" roll-distribution function alongside the
      existing advantage/disadvantage one.
    - Piercer (reroll 1s on damage dice) -- a damage-average formula
      tweak. Slasher/Crusher are mostly non-damage secondary effects
      and may not be worth modeling numerically.

Spell-save damage (Fireball, Chromatic Orb, etc.) is intentionally not
on this list yet -- the app is attack-roll-only today, and steps 9-12
round that out fully before any save-based mechanics get added.

## Notes for later steps

The debt noted during steps 1-7 (linting, CORS, hand-maintained
`types.ts`, `requirements.txt`, migrations-on-every-start, frontend
tests) was cleared in step 8. What's left, not yet scheduled:

- CI (`.github/workflows/ci.yml`) checks the code; CD
  (`cd-test.yml` / `cd-prod.yml`, both via `deploy-stack.yml`) builds,
  pushes, and deploys it -- to `powergaming-test` on push to `develop`,
  to `powergaming-prod` on a version tag on `main`. Prod rebuilds images
  from the tag rather than promoting the exact `:develop` images test
  ran; worth switching to promotion if test and prod ever drift.
- No auth yet on the `/api/builds` endpoints -- anyone who can reach the
  API can read/edit/delete any build. Fine while this is a single-person
  tool on the LAN; revisit once more users are introduced (see "Builds &
  comparison" territory -- not yet on this roadmap).
