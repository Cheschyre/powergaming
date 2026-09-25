"""FastAPI app exposing the power-gaming calculator over HTTP."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import builds
from app.schemas import (
    BreakevenRequest,
    BreakevenResponse,
    BreakevenRow,
    CalculateRequest,
    CalculateResponse,
)
from app.calculator import find_power_attack_breakeven
from app.service import compute_ac_results

app = FastAPI(title="Power Gaming Calculator API", version="0.2.0")

# Wide open for local dev. Tighten this to the real frontend origin(s)
# (e.g. https://powergaming.lab.cheschyre.com) once there's a frontend to protect against.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(builds.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/calculate", response_model=CalculateResponse)
def calculate(req: CalculateRequest) -> CalculateResponse:
    results = compute_ac_results(
        req.attack_bonus, req.ac_list, req.num_dice, req.die_sides, req.modifier,
        req.num_attacks, req.advantage, req.disadvantage, req.crit_range,
        req.power_attack, req.power_attack_bonus, req.power_attack_penalty,
    )
    return CalculateResponse(results=results)


@app.post("/api/breakeven", response_model=BreakevenResponse)
def breakeven(req: BreakevenRequest) -> BreakevenResponse:
    results, crossovers = find_power_attack_breakeven(
        req.attack_bonus, req.num_dice, req.die_sides, req.modifier,
        req.power_attack_bonus, req.power_attack_penalty,
        req.advantage, req.disadvantage, req.crit_range,
        req.ac_min, req.ac_max,
    )

    rows = [BreakevenRow(ac=ac, normal_had=normal, power_had=power) for ac, normal, power in results]
    return BreakevenResponse(rows=rows, crossovers=crossovers)
