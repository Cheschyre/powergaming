/**
 * Thin fetch wrapper around the backend API. Every function here maps
 * 1:1 to an endpoint in backend/app/main.py / backend/app/routers/builds.py.
 */

import type {
  BreakevenRequest,
  BreakevenResponse,
  Build,
  BuildCreate,
  CalculateRequest,
  CalculateResponse,
} from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    // FastAPI validation errors come back as JSON with a `detail` field;
    // fall back to raw text for anything else (network-level errors, etc).
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      // response wasn't JSON -- keep the statusText fallback
    }
    throw new Error(`${res.status}: ${detail}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export function calculate(req: CalculateRequest): Promise<CalculateResponse> {
  return request<CalculateResponse>("/api/calculate", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function breakeven(req: BreakevenRequest): Promise<BreakevenResponse> {
  return request<BreakevenResponse>("/api/breakeven", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function listBuilds(): Promise<Build[]> {
  return request<Build[]>("/api/builds");
}

export function createBuild(build: BuildCreate): Promise<Build> {
  return request<Build>("/api/builds", {
    method: "POST",
    body: JSON.stringify(build),
  });
}

export function deleteBuild(id: number): Promise<void> {
  return request<void>(`/api/builds/${id}`, { method: "DELETE" });
}

export function calculateForBuild(id: number, acList: number[]): Promise<CalculateResponse> {
  return request<CalculateResponse>(`/api/builds/${id}/calculate`, {
    method: "POST",
    body: JSON.stringify({ ac_list: acList }),
  });
}
