# Power Gaming Calculator

![CI](https://github.com/Cheschyre/powergaming/actions/workflows/ci.yml/badge.svg)

D&D 5e attack/damage probability calculator — hit chance, crit chance, and
hit-adjusted damage (HAD), with advantage/disadvantage, expanded crit
ranges, and a GWM/Sharpshooter-style power attack breakeven finder. Builds
can be saved and re-run against new target ACs without re-entering every
field, and there's now a browser UI on top of the API.

The original CLI script is now a full app with a versioned
frontend/backend, a test environment, and a production environment on
the home lab (steps 1-3 and 5-7 of the roadmap below are done; step 4's
test suite is ongoing).

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

Tests use an in-memory SQLite database (see `tests/conftest.py`), so they
don't need a real Postgres running:

```bash
cd backend
pip install -r requirements-dev.txt
pytest -v
```

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

Computes hit chance, crit chance, and HAD for one attack profile across a
list of target ACs. Set `power_attack: true` to also get the power-attack
(GWM/Sharpshooter-style) numbers for comparison at each AC.

```json
{
  "attack_bonus": 8,
  "ac_list": [12, 15, 18],
  "num_dice": 1,
  "die_sides": 12,
  "modifier": 3,
  "num_attacks": 2,
  "advantage": false,
  "disadvantage": false,
  "crit_range": 20,
  "power_attack": true,
  "power_attack_bonus": 10,
  "power_attack_penalty": -5
}
```

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

Save an attack profile. Body is the same shape as `/api/calculate` minus
`ac_list`, plus a `name`. Returns the saved build including its `id`.

### `GET /api/builds`

List all saved builds.

### `GET /api/builds/{id}`

Fetch one saved build. `404` if it doesn't exist.

### `PATCH /api/builds/{id}`

Partially update a saved build -- send only the fields you want to change.

### `DELETE /api/builds/{id}`

Delete a saved build. Returns `204 No Content`.

### `POST /api/builds/{id}/calculate`

Run a saved build's stored attack profile against a list of ACs, without
re-sending the whole profile:

```json
{ "ac_list": [12, 15, 18] }
```

Response shape is identical to `/api/calculate`.

## Project roadmap

1. ~~Backend API wrapping the existing logic~~ -- done.
2. ~~Postgres + Alembic migrations, saved builds~~ -- done.
3. ~~Frontend (React + TypeScript + Vite)~~ -- done.
4. Full pytest suite -- backend well underway; the frontend test suite
   is folded into step 8 below.
5. ~~GitHub Actions CI~~ -- done. Runs backend `pytest` and a
   frontend type-check + build on every push and PR, to every branch.
   Doesn't yet run a linter (ruff/ESLint) -- worth adding once CI itself
   is trusted and green.
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
8. Pay down engineering debt -- the backlog in "Notes for later steps"
   below, cleared out before step 9 adds more surface area to carry it
   across:
   - Linting: `ruff` for the backend, ESLint for the frontend, enforced
     in `ci.yml`.
   - Split `requirements.txt` into runtime vs. `requirements-dev.txt`.
   - Generate `frontend/src/types.ts` from `/openapi.json` instead of
     hand-maintaining it -- matters more once step 9 starts reshaping
     the schema.
   - Tighten CORS in `main.py` from `allow_origins=["*"]` to the real
     frontend origins.
   - Make migrations an explicit deploy step instead of `alembic
     upgrade head` auto-running on every container start, with an
     automatic pre-deploy `pg_dump` (today's manual version is under
     "Database" in `deploy/README.md`).
   - Frontend test suite (Vitest + React Testing Library) -- closes out
     step 4.
9. Multiple distinct attacks per round -- today `num_attacks` just
   repeats one attack profile; real rounds mix attacks (e.g. greatsword
   x2 + a bonus-action handaxe), each with its own bonus and damage.
   - `CalculateRequest`/`BuildBase` become a list of attack entries
     instead of one profile + a count, each with its own
     `attack_bonus`, damage dice, and its own power-attack
     (GWM/Sharpshooter) toggle -- per-attack, not round-global, so you
     can power-attack with the greatsword but not the off-hand hit.
   - Migration for existing saved builds -- each becomes a single-entry
     attack list so current data carries over unchanged.
   - UI: `CalculatorPanel`/`BuildsPanel` get a repeatable attack row in
     place of the single form.
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

Most of the debt noted during steps 1-7 (linting, CORS, hand-maintained
`types.ts`, `requirements.txt`, migrations-on-every-start) is scheduled
into step 8 above rather than tracked here twice. What's left, not yet
scheduled:

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
