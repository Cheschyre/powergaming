"""FastAPI app exposing the power-gaming calculator over HTTP."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.calculator import find_power_attack_breakeven
from app.routers import builds
from app.schemas import (
    BreakevenRequest,
    BreakevenResponse,
    BreakevenRow,
    CalculateRequest,
    CalculateResponse,
)
from app.service import compute_ac_results

# CORS only matters when the frontend is served from a different origin
# than the API -- i.e. local dev, where Vite (:5173) calls uvicorn (:8000).
# The deployed stacks serve both through nginx on one origin, so they set
# CORS_ALLOW_ORIGINS to empty, which leaves CORS off entirely.
DEFAULT_CORS_ALLOW_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"


def parse_origins(raw: str) -> list[str]:
    """Comma-separated origins -> list, ignoring blanks and whitespace."""
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def configure_cors(app: FastAPI, raw_origins: str) -> None:
    """Allow cross-origin calls from exactly these origins, or none if empty."""
    origins = parse_origins(raw_origins)
    if not origins:
        return
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        # Only what the frontend actually sends (see frontend/src/api.ts).
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Content-Type"],
    )


app = FastAPI(title="Power Gaming Calculator API", version="0.2.0")
configure_cors(app, os.environ.get("CORS_ALLOW_ORIGINS", DEFAULT_CORS_ALLOW_ORIGINS))

app.include_router(builds.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/calculate", response_model=CalculateResponse)
def calculate(req: CalculateRequest) -> CalculateResponse:
    results = compute_ac_results(
        req.attack_bonus,
        req.ac_list,
        req.num_dice,
        req.die_sides,
        req.modifier,
        req.num_attacks,
        req.advantage,
        req.disadvantage,
        req.crit_range,
        req.power_attack,
        req.power_attack_bonus,
        req.power_attack_penalty,
    )
    return CalculateResponse(results=results)


@app.post("/api/breakeven", response_model=BreakevenResponse)
def breakeven(req: BreakevenRequest) -> BreakevenResponse:
    results, crossovers = find_power_attack_breakeven(
        req.attack_bonus,
        req.num_dice,
        req.die_sides,
        req.modifier,
        req.power_attack_bonus,
        req.power_attack_penalty,
        req.advantage,
        req.disadvantage,
        req.crit_range,
        req.ac_min,
        req.ac_max,
    )

    rows = [
        BreakevenRow(ac=ac, normal_had=normal, power_had=power) for ac, normal, power in results
    ]
    return BreakevenResponse(rows=rows, crossovers=crossovers)
