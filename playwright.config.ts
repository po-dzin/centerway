import { defineConfig } from "@playwright/test";

/**
 * Two ways to run the browser specs under tests/e2e.
 *
 * With SMOKE_UI_BASE_URL set, they run against that deployment and this file
 * starts nothing — the platform spec needs a database behind the pages, so it
 * only ever runs this way, and CI gates it on the secret.
 *
 * Without it, this file starts `next start` on the built app and points the
 * specs at it. That gives CI a browser run with no secrets at all: the thanks
 * pages are static landings served from disk, and the one API call the spec
 * watches only has to START, so a database that is not there does not matter.
 * Until 2026-09-11 a missing secret meant zero browser coverage and a green job.
 */
/* 127.0.2.2, not 127.0.0.1: the thanks pages switch their auto-redirect OFF
   when the hostname is localhost or 127.0.0.1 (a local preview must not throw
   the developer at the production cabinet), and the redirect is exactly what
   the spec measures. Any other loopback address is a real visitor to the page.
   The health check below still uses 127.0.0.1; the server listens on all of it. */
const LOCAL_URL = "http://127.0.2.2:8000";
const baseURL = process.env.SMOKE_UI_BASE_URL || LOCAL_URL;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: process.env.SMOKE_UI_BASE_URL
    ? undefined
    : {
        command: "npm run -s start",
        url: "http://127.0.0.1:8000/way21/thanks",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
