import { randomUUID } from "node:crypto";
import { createSerwistRoute } from "@serwist/turbopack";

// Serves the service worker at /serwist/sw.js, built from src/app/sw.ts with
// esbuild (Turbopack can't build workers itself). /offline is precached under
// the deploy's commit, so each deploy refreshes it.
const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: "src/app/sw.ts",
  additionalPrecacheEntries: [{ url: "/offline", revision }],
  // The native esbuild package (installed for this), not the wasm one.
  useNativeEsbuild: true,
});
