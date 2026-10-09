import { describe, expect, it, vi } from "vitest";
import * as api from "./api";

function mockFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api", () => {
  it("POSTs JSON to the configured base URL and returns the parsed body", async () => {
    const fetchMock = mockFetch(json({ results: [] }));
    const req = {
      attack_bonus: 5,
      ac_list: [15],
      num_dice: 1,
      die_sides: 8,
      modifier: 3,
      num_attacks: 1,
      advantage: false,
      disadvantage: false,
      crit_range: 20,
      power_attack: false,
      power_attack_bonus: 0,
      power_attack_penalty: 0,
    };

    await expect(api.calculate(req)).resolves.toEqual({ results: [] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/calculate");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual(req);
  });

  it("builds per-build URLs", async () => {
    const fetchMock = mockFetch(json({ results: [] }));
    await api.calculateForBuild(42, [12, 15]);
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/api/builds/42/calculate");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ ac_list: [12, 15] });
  });

  it("returns undefined for 204 No Content", async () => {
    const fetchMock = mockFetch(new Response(null, { status: 204 }));
    await expect(api.deleteBuild(3)).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/api/builds/3");
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });

  it("surfaces a string `detail` from error responses", async () => {
    mockFetch(json({ detail: "Build not found" }, 404));
    await expect(api.listBuilds()).rejects.toThrow("404: Build not found");
  });

  it("serializes structured validation errors", async () => {
    const detail = [{ loc: ["body", "ac_list"], msg: "Each AC must be between 1 and 30." }];
    mockFetch(json({ detail }, 422));
    await expect(api.listBuilds()).rejects.toThrow(`422: ${JSON.stringify(detail)}`);
  });

  it("falls back to the status text when the error body isn't JSON", async () => {
    mockFetch(new Response("<html>bad gateway</html>", { status: 502, statusText: "Bad Gateway" }));
    await expect(api.listBuilds()).rejects.toThrow("502: Bad Gateway");
  });

  it("uses relative URLs when VITE_API_BASE_URL is empty (deployed behind nginx)", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.resetModules();
    const fresh = await import("./api");
    const fetchMock = mockFetch(json([]));

    await fresh.listBuilds();

    expect(fetchMock.mock.calls[0][0]).toBe("/api/builds");
    vi.unstubAllEnvs();
  });
});
