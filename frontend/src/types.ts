/**
 * Friendly names for the API's request/response types.
 *
 * Don't hand-edit the shapes here: they come from api-schema.ts, which is
 * generated from the backend's Pydantic models (backend/app/schemas.py)
 * via their OpenAPI schema. After changing a model, regenerate with
 * `scripts/gen-api-types.sh` from the repo root -- CI fails if the
 * committed files are stale.
 */

import type { components } from "./api-schema";

type Schemas = components["schemas"];

export type AttackEntry = Schemas["AttackEntry"];
export type AttackResult = Schemas["AttackResult"];
export type CalculateRequest = Schemas["CalculateRequest"];
export type ACResult = Schemas["ACResult"];
export type CalculateResponse = Schemas["CalculateResponse"];

export type BreakevenRequest = Schemas["BreakevenRequest"];
export type BreakevenRow = Schemas["BreakevenRow"];
export type BreakevenResponse = Schemas["BreakevenResponse"];

export type Build = Schemas["BuildRead"];
export type BuildCreate = Schemas["BuildCreate"];
export type BuildUpdate = Schemas["BuildUpdate"];
export type BuildCalculateRequest = Schemas["BuildCalculateRequest"];
