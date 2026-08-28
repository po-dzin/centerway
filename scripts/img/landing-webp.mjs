/**
 * Re-encodes the images the LANDINGS actually serve.
 *
 * WHY A SECOND SCRIPT AND NOT A FLAG ON THE FIRST. `scripts/img/webp.mjs`
 * converts a fixed tree — every plate under `public/cw/platform` — because
 * every one of them is a plate this product drew on purpose. The landing tree
 * is nothing like that: 33 MB of files accumulated across five funnels and
 * several redesigns, of which an audit found **9.2 MB is referenced at all**.
 * Converting the rest would be work, weight and reference-rewriting for images
 * no browser ever asks for.
 *
 * So this one starts from the references, not from the directory: it parses
 * every landing HTML, CSS and JS file, resolves the paths they name, and
 * converts only what is both reachable and worth converting.
 *
 * WHAT IT FOUND ON THE FIRST RUN. `short/img/expert-photo.jpg` — 3.1 MB, one
 * third of everything the funnels serve, on the page that takes the money.
 *
 * WHAT IT LEAVES ALONE:
 *   - anything already WebP or AVIF;
 *   - `.gif`, which may be animated, and `.mp4`;
 *   - `legacy/**`;
 *   - files under the threshold, where the rewrite costs more than the bytes;
 *   - the originals, which stay until the references have been verified in a
 *     browser. Nothing here deletes.
 *
 * Usage: node scripts/img/landing-webp.mjs [--write] [--force]
 *        (dry run by default — this rewrites money pages)
 */

import { execFileSync } from "node:child_process";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const ROOT = "src/landing-static";

/**
 * Longest side, not width — and 1200, not the platform's 1600.
 *
 * A landing image sits in a box the page has already sized: the author photo is
 * declared `width="360" height="480"`, the testimonials are a carousel of
 * phone screenshots. 1200 on the long side covers every one of them on a 2×
 * screen with room to spare. The source for that author photo was 5152×7728 —
 * a camera file, uploaded as-is, three megabytes of detail for a box the size
 * of a postcard.
 */
const LONGEST_SIDE = 1200;
const QUALITY = 80;

/** Below this the rewrite is churn on a money page for a few kilobytes. */
const THRESHOLD = 80 * 1024;

const write = process.argv.includes("--write");
const force = process.argv.includes("--force");

const SOURCE_FILES = /\.(html|css|js)$/i;
const CONVERTIBLE = /\.(png|jpe?g)$/i;
const REFERENCE = /(?:data-src|data-srcset|src|srcset|href|url)\s*[=(]\s*["']?([^"'\s)>]+\.(?:png|jpe?g|gif|webp|avif))/gi;

const files = execFileSync("git", ["ls-files", ROOT], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((file) => SOURCE_FILES.test(file) && !file.includes("/legacy/"));

/** Every image path a landing names, resolved to a file on disk. */
const referenced = new Map();

for (const file of files) {
  let body;
  try {
    body = await readFile(file, "utf8");
  } catch {
    continue;
  }
  for (const [, reference] of body.matchAll(REFERENCE)) {
    if (/^(https?:)?\/\//.test(reference) || reference.startsWith("data:")) continue;
    const resolved = reference.startsWith("/")
      ? path.join(ROOT, reference.slice(1))
      : path.normalize(path.join(path.dirname(file), reference));
    if (!referenced.has(resolved)) referenced.set(resolved, new Set());
    referenced.get(resolved).add(file);
  }
}

const work = [];
for (const [file] of referenced) {
  if (!CONVERTIBLE.test(file)) continue;
  let info;
  try {
    info = await stat(file);
  } catch {
    continue;
  }
  if (info.size >= THRESHOLD) work.push({ file, bytes: info.size });
}

work.sort((a, b) => b.bytes - a.bytes);

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;
let before = 0;
let after = 0;
const renames = new Map();

for (const { file, bytes } of work) {
  const target = file.replace(CONVERTIBLE, ".webp");

  let output;
  if (!force) {
    try {
      const existing = await stat(target);
      output = { byteLength: existing.size };
    } catch {
      /* Not there yet. */
    }
  }

  if (!output) {
    // PNG SOURCES GO LOSSLESS. A photograph was saved as JPEG and re-encoding it
    // lossily loses nothing anyone can see; a PNG in this tree is flat art with
    // an alpha channel — a payment-card strip, a badge — and quantising it puts
    // visible mush on the edge of a logo. Lossless WebP is still well under the
    // PNG, so there is nothing to trade.
    const lossless = /\.png$/i.test(file);
    const encoded = await sharp(await readFile(file))
      .rotate()
      .resize({ width: LONGEST_SIDE, height: LONGEST_SIDE, fit: "inside", withoutEnlargement: true })
      .webp(lossless ? { lossless: true } : { quality: QUALITY })
      .toBuffer();
    if (write) await writeFile(target, encoded);
    output = encoded;
  }

  before += bytes;
  after += output.byteLength;
  renames.set(path.basename(file), path.basename(target));
  console.log(`${kb(bytes).padStart(8)} → ${kb(output.byteLength).padStart(8)}   ${file.replace(`${ROOT}/`, "")}`);
}

if (work.length === 0) {
  console.log("Nothing over the threshold is referenced.");
  process.exit(0);
}

console.log(`\n${work.length} images: ${kb(before)} → ${kb(after)} (${(before / after).toFixed(1)}× smaller)\n`);

// ─── The references ─────────────────────────────────────────────────────────
//
// Matched on the FILENAME rather than on the whole path: the same picture is
// named from `index.html` as `img/x.jpg`, from a stylesheet one directory
// deeper as `../img/x.jpg`, and from a shared page as `/shared/img/x.jpg`. One
// basename covers all three, and a basename in this tree is unique enough —
// the audit above resolved every reference to exactly one file.

let touched = 0;
for (const file of files) {
  let body = await readFile(file, "utf8");
  const original = body;
  for (const [from, to] of renames) {
    body = body.split(from).join(to);
  }
  if (body === original) continue;
  if (write) await writeFile(file, body);
  touched += 1;
  console.log(`rewrite ${file}`);
}

console.log(`\n${touched} source file(s) ${write ? "rewritten" : "would be rewritten"}.`);
if (!write) console.log("Dry run — pass --write to apply.");
