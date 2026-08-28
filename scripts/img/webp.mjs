/**
 * Re-encodes the shipped raster artwork to WebP, once, in place.
 *
 * WHY THIS EXISTS. The platform's own photography ships as PNG — 2.8 MB for a
 * single landing hero, 65 MB across forty files — and every byte of it travels
 * to every visitor. Nothing about those images needs PNG: they are photographs
 * and rendered plates, not screenshots with flat colour, and PNG is simply what
 * the generator wrote. WebP at quality 80 is the same picture at roughly a
 * fifteenth of the size.
 *
 * WHY A ONE-SHOT SCRIPT AND NOT A BUILD STEP. The sources are versioned assets
 * with stable public paths, referenced from code, from data files, and from
 * rows in the database. Converting them is a migration, and a migration is a
 * thing you run, read, and commit — not a thing that happens invisibly on every
 * build and leaves the repository disagreeing with the deployment.
 *
 * WHAT IT DOES NOT TOUCH:
 *   - `public/cw/brand/**` — the PWA icon set and the OG cover. A manifest icon
 *     is required to be PNG, and social crawlers read WebP unevenly. The bytes
 *     there are small and the risk is not worth it.
 *   - `public/cw/img/_staging/**` — generator output, gitignored, wired to
 *     nothing.
 *   - the originals. They stay until the database rows that name them have been
 *     moved too; see docs/perf/static-artwork-webp-2026-08-28.md.
 *
 * ─── The second pass: card-sized copies (2026-08-28) ────────────────────────
 *
 * Re-encoding fixed the codec; it did not fix the SIZE. A program card in the
 * catalogue grid is about 370 CSS pixels wide, and it was drawing a 1600px
 * plate as a CSS background — six of them on the home page, measured at just
 * over a megabyte together. So every plate above the threshold also gets a
 * 960px copy: enough for that card on a 2× screen, and about a fifth of the
 * bytes. The full-width heroes keep the full file.
 *
 * The copies are named by WIDTH rather than by role. `-card` would be a promise
 * about layout that the CSS could quietly break; `-960` is a fact about the
 * file.
 *
 * Usage: node scripts/img/webp.mjs [--force]
 */

import { execFileSync } from "node:child_process";
import { readFile, stat, writeFile } from "node:fs/promises";

import sharp from "sharp";

/** The one width anything in this product is drawn at, doubled for retina. */
const WIDTH = 1600;
const QUALITY = 80;

const force = process.argv.includes("--force");

const tracked = execFileSync("git", ["ls-files", "public/cw/platform", "public/cw/courses"], {
  encoding: "utf8",
})
  .split("\n")
  .filter((path) => /\.(png|jpe?g)$/i.test(path));

let before = 0;
let after = 0;
let written = 0;

for (const source of tracked) {
  const target = source.replace(/\.(png|jpe?g)$/i, ".webp");

  if (!force) {
    try {
      await stat(target);
      console.log(`skip  ${target} (exists)`);
      continue;
    } catch {
      // Not there yet, which is the normal case.
    }
  }

  const input = await readFile(source);
  const output = await sharp(input)
    .rotate()
    .resize({ width: WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();

  await writeFile(target, output);

  before += input.byteLength;
  after += output.byteLength;
  written += 1;
  const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;
  console.log(`write ${target}  ${kb(input.byteLength)} → ${kb(output.byteLength)}`);
}

if (written === 0) {
  console.log("\nNothing to re-encode.");
} else {
  const mb = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  console.log(`\n${written} files: ${mb(before)} → ${mb(after)} (${(before / after).toFixed(1)}× smaller)`);
}

// ─── Card-sized copies ──────────────────────────────────────────────────────

/** Below this a plate is already card-sized and a copy would save nothing. */
const NARROW_THRESHOLD = 100 * 1024;
const NARROW_WIDTH = 960;

// Platform artwork only. A lesson photograph is drawn inside the reading
// column at its own width and has no card to be too big for; a copy of it would
// be a file to keep in sync that nothing ever asks for.
const plates = execFileSync("git", ["ls-files", "public/cw/platform"], { encoding: "utf8" })
  .split("\n")
  .filter((path) => path.endsWith(".webp") && !path.endsWith(`-${NARROW_WIDTH}.webp`))
  // The re-encodes from the pass above are not tracked yet on a first run.
  .concat(
    tracked
      .filter((path) => path.startsWith("public/cw/platform/"))
      .map((path) => path.replace(/\.(png|jpe?g)$/i, ".webp")),
  )
  .filter((path, index, all) => all.indexOf(path) === index);

let narrow = 0;
let narrowBefore = 0;
let narrowAfter = 0;

for (const source of plates) {
  let input;
  try {
    input = await readFile(source);
  } catch {
    continue;
  }
  if (input.byteLength < NARROW_THRESHOLD) continue;

  const target = source.replace(/\.webp$/, `-${NARROW_WIDTH}.webp`);
  if (!force) {
    try {
      await stat(target);
      continue;
    } catch {
      /* Not there yet. */
    }
  }

  const output = await sharp(input)
    .resize({ width: NARROW_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();

  // A copy that is not meaningfully smaller is a file to keep in sync for
  // nothing — the source was already near this width.
  if (output.byteLength > input.byteLength * 0.8) continue;

  await writeFile(target, output);
  narrow += 1;
  narrowBefore += input.byteLength;
  narrowAfter += output.byteLength;
  console.log(`card  ${target}  ${Math.round(input.byteLength / 1024)} KB → ${Math.round(output.byteLength / 1024)} KB`);
}

if (narrow > 0) {
  const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;
  console.log(`\n${narrow} card copies: ${kb(narrowBefore)} → ${kb(narrowAfter)} when a card draws them`);
} else {
  console.log("\nNo card copies needed.");
}
