// Runs before every test file (see vite.config.ts `test.setupFiles`).
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  // Reset recorded calls AND implementations of every mock, including
  // vi.mock() automocks, so nothing leaks from one test into the next.
  vi.resetAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
