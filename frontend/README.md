# Frontend

React + TypeScript + Vite, talking to the FastAPI backend in `../backend`.

## Structure

```
frontend/
├── src/
│   ├── api-schema.ts          # GENERATED -- see ../scripts/gen-api-types.sh
│   ├── types.ts               # friendly names for the generated API types
│   ├── api.ts                 # fetch wrapper, one function per endpoint
│   ├── App.tsx                # tab switcher: Calculator / Breakeven / Saved Builds
│   ├── main.tsx                # React entry point
│   ├── styles.css
│   └── components/
│       ├── CalculatorPanel.tsx    # /api/calculate
│       ├── BreakevenPanel.tsx     # /api/breakeven
│       ├── BuildsPanel.tsx        # /api/builds CRUD + per-build calculate
│       ├── ResultsTable.tsx       # shared results table (Calculator + Builds)
│       ├── NumberField.tsx        # small reusable form controls
│       └── CheckboxField.tsx
├── index.html
├── vite.config.ts
├── tsconfig*.json
└── package.json
```

## Running locally

The backend needs to be running first (see `../backend/README.md` or the
root README -- `docker compose up` from the repo root covers both API and
database).

```bash
npm install
npm run dev
```

Opens on `http://localhost:5173` by default and talks to the API at
`http://localhost:8000` (see `.env.example` -- copy to `.env.local` if you
need to point it somewhere else, e.g. once there's a test/prod URL on the
home lab).

## Building for production

```bash
npm run build
```

Type-checks with `tsc -b` and then produces a static build in `dist/` via
Vite. The deployed stacks build this in `Dockerfile` and serve `dist/`
through nginx, which also proxies `/api/*` to the backend (see
`nginx.conf` and `../deploy/README.md`).

## Linting

```bash
npm run lint
```

ESLint with the TypeScript, React Hooks and React Refresh rules
(`eslint.config.js`). CI runs it with `--max-warnings=0`.
