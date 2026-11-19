import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Database tests (RLS, triggers) against local Supabase, run with
// `npm run test:db`. They need Docker and `npx supabase start`, so they're
// kept out of `npm run test`.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    // Reads .env.test.local (gitignored): the local Supabase URL and key.
    env: loadEnv("test", process.cwd(), "SUPABASE_TEST_"),
    // Each test signs up users over HTTP; give a slow first start some room.
    testTimeout: 20_000,
  },
});
