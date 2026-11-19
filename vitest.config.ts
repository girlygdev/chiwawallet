import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for the pure functions in src/lib (period, plan and money math,
// validation). They run in Node: no browser, no React rendering yet.
export default defineConfig({
  resolve: {
    // Same "@/..." imports as tsconfig.json's paths, so tests import like the app.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    // Tests live in tests/, mirroring src/lib (see CLAUDE.md).
    include: ["tests/**/*.test.ts"],
  },
});
