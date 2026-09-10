import { defineConfig } from "@playwright/test";

/**
 * Browser smoke against a RUNNING deployment, never a server this config starts.
 *
 * Both specs under tests/e2e read SMOKE_UI_BASE_URL themselves and default to a
 * local port, so this file adds nothing they did not already assume — it exists
 * so `npx playwright test` has a testDir, a timeout and a reporter, and so the
 * specs stop being run only by the two npm scripts that name them by path.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.SMOKE_UI_BASE_URL,
    trace: "retain-on-failure",
  },
});
