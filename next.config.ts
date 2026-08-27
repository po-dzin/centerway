import type { NextConfig } from "next";

/**
 * THE DEV SERVER AND A PRODUCTION BUILD GET SEPARATE OUTPUT DIRECTORIES.
 *
 * They used to share `.next`, and that is not a tidiness problem — it corrupts
 * a running dev server. `next build` rewrites and deletes files under the
 * directory Turbopack's persistent cache database is simultaneously reading, so
 * the dev server starts failing with either
 *
 *   Unable to open static sorted file 00000044.sst (os error 2)
 *   Failed to restore task data (corrupted database or bug)
 *
 * or an `ENOENT` on a route's `build-manifest.json`. Every route then answers
 * 500 — which on this repo reads as "sign-in stopped working on localhost",
 * because the account shell is the first thing that fails to render. The two
 * processes also race for `.next/lock`, so one of them simply hangs instead.
 *
 * It is more likely here than in most repos: `ds:qa` and `lms:qa` both end in
 * `npm run build`, and running a gate while a preview is open is the normal way
 * to work. One agent verifying a change should not be able to break another
 * one's browser.
 *
 * KEYED ON `NODE_ENV`, not on a script-level env var, because the dev server is
 * started several ways — `npm run dev`, `npm run dev:alt`, and the bare
 * `npx next dev -p …` entries in `.claude/launch.json`. Next sets `NODE_ENV`
 * before it loads this file, so every one of those paths lands on the dev
 * directory without having to remember a flag.
 *
 * `.next` is deliberately still the PRODUCTION directory: Vercel builds with
 * `NODE_ENV=production` and expects to find the output where it always was, so
 * deployment is untouched by this.
 */
const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  reactCompiler: true,
  devIndicators: false,
  distDir: isDev ? ".next-dev" : ".next",
};

export default nextConfig;
