import { describe, expect, it, vi } from "vitest";
import * as api from "./api";
import { newCharacter } from "./characters";
import { greatsword } from "./test/fixtures";

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
      ac_list: [15],
      attacks: [greatsword, { ...greatsword, power_attack: true }],
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

  it("PATCHes build changes", async () => {
    const fetchMock = mockFetch(json({ id: 4 }));
    await api.updateBuild(4, { name: "Renamed" });
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/api/builds/4");
    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name: "Renamed" });
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

  it("turns structured validation errors into readable text", async () => {
    const detail = [
      { loc: ["body", "character", "level"], msg: "Input should be less than or equal to 20" },
      { loc: ["body"], msg: "Value error, Two-weapon fighting needs a light melee weapon." },
    ];
    mockFetch(json({ detail }, 422));
    await expect(api.listBuilds()).rejects.toThrow(
      "422: character.level: Input should be less than or equal to 20; " +
        "Two-weapon fighting needs a light melee weapon.",
    );
  });

  it("PUTs a whole character sheet and posts toggles to run or save one", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => json({}));
    vi.stubGlobal("fetch", fetchMock);
    const toggles = { advantage: true, disadvantage: false, power_attack: false };

    await api.calculateForCharacter(7, [15], toggles);
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/api/characters/7/calculate");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ ac_list: [15], toggles });

    await api.saveCharacterAsBuild(7, toggles);
    expect(fetchMock.mock.calls[1][0]).toBe("http://api.test/api/characters/7/save-as-build");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ toggles });

    const sheet = { ...newCharacter(), name: "Vex" };
    await api.replaceCharacter(7, sheet);
    expect(fetchMock.mock.calls[2][0]).toBe("http://api.test/api/characters/7");
    expect(fetchMock.mock.calls[2][1].method).toBe("PUT");
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual(sheet);
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
