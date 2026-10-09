import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // Tests must not depend on a developer's .env.local.
    env: { VITE_API_BASE_URL: "http://api.test" },
  },
});
