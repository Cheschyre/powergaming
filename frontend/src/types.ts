/**
 * TypeScript mirrors of the backend's Pydantic schemas
 * (backend/app/schemas.py). Kept in sync by hand for now -- if this ever
 * drifts from the backend, that's a sign it's worth generating this file
 * from the OpenAPI schema FastAPI already produces at /openapi.json.
 */

export interface CalculateRequest {
  attack_bonus: number;
  ac_list: number[];
  num_dice: number;
  die_sides: number;
  modifier: number;
  num_attacks: number;
  advantage: boolean;
  disadvantage: boolean;
  crit_range: number;
  power_attack: boolean;
  power_attack_bonus: number;
  power_attack_penalty: number;
}

export interface ACResult {
  ac: number;
  hit_chance: number;
  crit_chance: number;
  had: number;
  total_had_per_round: number;
  power_hit_chance: number | null;
  power_crit_chance: number | null;
  power_had: number | null;
  power_total_had_per_round: number | null;
}

export interface CalculateResponse {
  results: ACResult[];
}

export interface BreakevenRequest {
  attack_bonus: number;
  num_dice: number;
  die_sides: number;
  modifier: number;
  power_attack_bonus: number;
  power_attack_penalty: number;
  advantage: boolean;
  disadvantage: boolean;
  crit_range: number;
  ac_min: number;
  ac_max: number;
}

export interface BreakevenRow {
  ac: number;
  normal_had: number;
  power_had: number;
}

export interface BreakevenResponse {
  rows: BreakevenRow[];
  crossovers: number[];
}

export interface Build {
  id: number;
  name: string;
  attack_bonus: number;
  num_dice: number;
  die_sides: number;
  modifier: number;
  num_attacks: number;
  advantage: boolean;
  disadvantage: boolean;
  crit_range: number;
  power_attack: boolean;
  power_attack_bonus: number;
  power_attack_penalty: number;
  created_at: string;
  updated_at: string;
}

export type BuildCreate = Omit<Build, "id" | "created_at" | "updated_at">;
