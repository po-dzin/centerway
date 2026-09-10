import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors the `@/*` path alias from tsconfig.json.
    alias: {
      "@": path.resolve(__dirname, "src"),
      // `import "server-only"` throws outside Next's react-server condition;
      // vitest is Node, and the tests ARE server code. Same stub the scripts'
      // loader uses (scripts/lib/ts-hooks.mjs).
      "server-only": path.resolve(__dirname, "src/lib/db/server-only.stub.ts"),
    },
  },
  test: {
    // Unit tests live next to the code they cover.
    // tests/e2e/**.spec.ts belongs to Playwright and must stay out of vitest.
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
    /* 15s, not the 5s default, and not because any test is slow.
       These suites `await import()` the module under test INSIDE the first
       test, after `vi.mock` has been set up — so that one test pays the cold
       transform cost of the whole import graph (next/cache, the offers layer,
       lms-core). Alone that is ~250ms; with 73 files competing for workers it
       crossed 5s and failed `authors.test.ts` in CI while passing locally.
       A timeout is a deadlock guard, not a performance budget: raising it
       removes a false red without hiding a slow test, which the per-test
       durations in the reporter still show. */
    testTimeout: 15_000,
  },
});
