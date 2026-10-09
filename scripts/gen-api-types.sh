#!/usr/bin/env bash
# Regenerate the frontend's API types from the backend's Pydantic schemas:
#   backend/app/schemas.py -> frontend/openapi.json -> frontend/src/api-schema.ts
# Run after changing any request/response model. CI runs this too and
# fails if the committed files are out of date.
#
# Needs backend deps installed (pip install -r backend/requirements.txt)
# and frontend deps (cd frontend && npm ci). PYTHON overrides the
# interpreter, e.g. PYTHON=backend/.venv/bin/python.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
"${PYTHON:-python}" "$root/backend/scripts/export_openapi.py" "$root/frontend/openapi.json"
cd "$root/frontend"
npx --no-install openapi-typescript openapi.json -o src/api-schema.ts
