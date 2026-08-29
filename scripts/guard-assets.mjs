/**
 * Every asset path written in code or data points at a file that exists.
 *
 * WHY THIS IS A GUARD AND NOT A CONVENTION. Two changes in one week wrote paths
 * that only a browser could check: the WebP re-encode renamed forty plates and
 * updated their references by hand, and `PlatformOfferArtwork.card` names a
 * 960px copy that a build step generates. Neither the compiler nor a test knows
 * that `"/cw/platform/programs/irem-hero-desktop-v2-960.webp"` is a file rather
 * than a string, and the failure mode is a public landing with a hole in it.
 *
 * A DERIVED PATH WOULD NOT NEED THIS, AND THAT IS THE POINT. `card` could have
 * been `desktop.replace(".webp", "-960.webp")` and saved nine lines of data —
 * at the cost of a rule that is true until someone adds a plate small enough
 * not to get a copy, and then it is a 404 nobody wrote down. Written out and
 * checked here, the same fact costs one script and fails on the machine that
 * made the mistake.
 *
 * TWO KINDS OF REFERENCE, because the two trees address assets differently:
 *
 *   - the application writes ABSOLUTE paths — `/cw/**`, `/shared/**` — from
 *     anywhere in `src` and `data`;
 *   - a landing writes RELATIVE ones — `img/expert-photo.webp`, `../shared/…` —
 *     from inside its own directory, because the same HTML is served both by a
 *     funnel host at its web root and by the platform through a route handler.
 *
 * The second kind is why this guard grew: a WebP pass rewrote sixteen image
 * references across four landing pages by string replacement, on the pages that
 * take the money. A typo there is a hole in a sales page that nothing else in
 * the repository would notice.
 *
 * External URLs, database-supplied paths, `_staging` output and test fixtures
 * are not ours to verify: a `*.test.ts` is free to name a path that has never
 * existed on disk — see `src/lib/lms/media.ts`'s own test, which asserts on
 * `/cw/platform/cabinet/cover.webp` as a stand-in for "some repo asset", not as
 * a claim that file exists. Checking it produced exactly the false failure this
 * comment warns about, the day another change happened to populate that
 * directory for real.
 *
 * Usage: npm run guard:assets
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

/** Where a public path is actually served from. */
const ROOTS = [
  { prefix: "/cw/", dir: path.join(rootDir, "public") },
  // `/shared/**` is one tree reachable two ways: the funnel hosts serve
  // src/landing-static as their web root, and the platform serves the same
  // files from /public. A reference is satisfied by either.
  { prefix: "/shared/", dir: path.join(rootDir, "src", "landing-static") },
  { prefix: "/shared/", dir: path.join(rootDir, "public") },
];

const PATTERN = /["'`](\/(?:cw|shared)\/[A-Za-z0-9_\-/.@]+\.(?:png|jpe?g|webp|avif|gif|svg|woff2?|mp4|webm))["'`]/g;

const files = execFileSync("git", ["ls-files", "src", "data"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((file) => /\.(ts|tsx|mjs|js|json|css|md|html)$/.test(file))
  .filter((file) => !/\.(test|spec)\.[jt]sx?$/.test(file))
  .filter((file) => !file.startsWith("src/landing-static/legacy/"));

function resolves(reference) {
  for (const root of ROOTS) {
    if (!reference.startsWith(root.prefix)) continue;
    const relative = reference.slice(1);
    if (fs.existsSync(path.join(root.dir, relative))) return true;
  }
  return false;
}

/** How a landing page names its own images: relative to the file that names them. */
const LANDING_ROOT = path.join(rootDir, "src", "landing-static");
const RELATIVE = /(?:data-src|data-srcset|src|srcset|href|url)\s*[=(]\s*["']?((?!https?:|\/\/|data:|#|mailto:|tel:)[A-Za-z0-9_\-./]+\.(?:png|jpe?g|webp|avif|gif|svg|woff2?|mp4|webm))/g;

const missing = [];
let checked = 0;

for (const file of files) {
  let body;
  try {
    body = fs.readFileSync(path.join(rootDir, file), "utf8");
  } catch {
    continue;
  }
  // A path inside an HTML comment is documentation, not a dependency. The
  // landings carry commented-out template blocks — a video-testimonial card
  // with a placeholder poster and an `XXXXXXXX` video id, waiting for someone
  // to uncomment it — and those must not read as broken references.
  const scannable = file.endsWith(".html") ? body.replace(/<!--[\s\S]*?-->/g, "") : body;

  for (const match of new Set([...scannable.matchAll(PATTERN)].map((m) => m[1]))) {
    checked += 1;
    if (!resolves(match)) missing.push({ file, reference: match });
  }

  if (!file.startsWith("src/landing-static/") || !/\.(html|css|js)$/.test(file)) continue;

  for (const match of new Set([...scannable.matchAll(RELATIVE)].map((m) => m[1]))) {
    if (match.startsWith("/")) continue;
    checked += 1;
    const resolved = path.resolve(path.dirname(path.join(rootDir, file)), match);
    // A landing may only reach inside its own tree; a reference that climbs out
    // of it is a bug even when the file happens to exist.
    if (!resolved.startsWith(LANDING_ROOT) || !fs.existsSync(resolved)) {
      missing.push({ file, reference: match });
    }
  }
}

if (missing.length > 0) {
  console.error(`[FAIL] Asset guard — ${missing.length} reference(s) point at nothing:\n`);
  for (const { file, reference } of missing) console.error(`  ${reference}\n    ← ${file}`);
  console.error("");
  process.exit(1);
}

console.log(`[PASS] Asset guard — ${checked} references across ${files.length} files, all present.`);
