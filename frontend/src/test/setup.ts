// Runs before every test file (see vite.config.ts `test.setupFiles`).
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom has no ResizeObserver; Recharts' ResponsiveContainer needs one.
// (It measures 0x0 here, so charts render empty -- tests check the table
// view, which carries every value the chart shows.)
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

afterEach(() => {
  cleanup();
  // Reset recorded calls AND implementations of every mock, including
  // vi.mock() automocks, so nothing leaks from one test into the next.
  vi.resetAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
