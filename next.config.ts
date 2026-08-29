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

  /**
   * CACHING FOR `public/`, WHICH NEXT DOES NOT DO FOR YOU.
   *
   * Everything under `public/` ships with `Cache-Control: public, max-age=0,
   * must-revalidate` by default. Not "cached badly" — NOT CACHED. The browser
   * asks again for every one of these files on every page view. The answer is
   * usually a 304, which is cheap in bytes and is still a full round trip and
   * still a billed edge request.
   *
   * The scale of it: 26 font files and 269 images live under `public/`, and a
   * platform page pulls roughly fifteen of them — six woff2, the icon sprite,
   * the brand mark, and the hero art. Measured 2026-08-29 on the live site,
   * every one came back `max-age=0, must-revalidate`, while `_next/static/*`
   * (which Next DOES handle) came back `immutable` and the landing bundles came
   * back `max-age=3600`. So the one part of the asset tree nobody had set a
   * policy for was the part being re-fetched forever, by every visitor, on
   * every navigation. That is the shape of an edge-request bill that grows with
   * pages shipped rather than with customers served.
   *
   * FONTS GET `immutable`, AND SAFELY: their names are content hashes from the
   * font pipeline (`xn7gYHE41ni1AdIRggexSvfedN4.woff2`), so a different file is
   * a different URL and a year-long cache can never serve a stale one.
   *
   * `/cw/**` GETS A WEEK, NOT A YEAR, and that asymmetry is the point. Most of
   * this art IS versioned in its filename (`-v2`, `-960`, `-2026-08`) and could
   * take `immutable` too — but two of the most-requested files are not:
   * `cw/icons/cw-icons.svg` and `cw/brand/cw-mark.svg` are BAKED artifacts
   * (`npm run icons:build`, `npm run brand:build`) that keep their name when
   * they change. Under `immutable` a redrawn icon would never reach anyone who
   * had already visited. A week is the trade: ~99% of these round trips
   * disappear, and a rebuilt sprite still reaches returning visitors within it.
   *
   * If that week ever becomes the wrong answer, the fix is not a shorter cache
   * — it is content-hashing those two baked filenames, after which this whole
   * source can take `immutable` like the fonts do.
   *
   * NOT MATCHED HERE, deliberately: `sw.js` and `offline.html` at the root of
   * `public/`. A long-cached service worker is a page that cannot be updated,
   * and the default must-revalidate is exactly right for it.
   */
  async headers() {
    return [
      {
        source: "/fonts/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/cw/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;
