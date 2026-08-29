#!/usr/bin/env node
/**
 * Band guard — "two blocks in a row never share a band".
 *
 * Between two blocks on a landing there is nothing but air: `--sp-sec` of
 * padding on each side, up to 264px of it. The only thing that says a block
 * ended and another began is the band the section sits on — `.sec` on the page
 * canvas, `.sec-alt` on the cool tint. Alternate them and every seam is drawn
 * for free; put two of the same kind next to each other and that seam vanishes
 * completely, and two blocks with entirely different jobs (proof and FAQ, author
 * and testimonials) read as one very long block.
 *
 * It is worth a machine because it drifts silently and by accident: the classes
 * are hand-written per section, and inserting or reordering one block flips the
 * parity of every block below it. That is exactly how it broke on three of the
 * five landings — reset-day's own working notes record the same thing happening
 * when `#day-look` was inserted (2026-08-18).
 *
 * The hero is excluded: it sets its own ground (photo or canvas) and the first
 * block after it always lands on the base band across the network.
 *
 * Usage:
 *   node scripts/guard-bands.mjs            # fail on violations
 *   node scripts/guard-bands.mjs --report   # print the band map of every page
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..");

/**
 * The CenterWay network only — Short and IREM are other authors with their own
 * visual territory, same exclusion the carrier guard makes.
 */
const SURFACES = ["way21", "reset-day", "consult", "herbs", "dosha"];

const REPORT = process.argv.includes("--report");

function bandsOf(html) {
  const out = [];
  for (const m of html.matchAll(/<section\b([^>]*)>/g)) {
    const attrs = m[1];
    const cls = (attrs.match(/class="([^"]*)"/) || [, ""])[1];
    if (/\bhero\b/.test(cls)) continue;
    if (!/\bsec\b/.test(cls)) continue;
    const id = (attrs.match(/id="([^"]*)"/) || [, ""])[1];
    // The nearest heading after the tag, purely so a failure names the block a
    // human can find rather than an index.
    const after = html.slice(m.index, m.index + 900);
    const h = (after.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [, ""])[1]
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    out.push({ band: /\bsec-alt\b/.test(cls) ? "alt" : "base", id, title: h || id || "—" });
  }
  return out;
}

let failures = 0;

for (const surface of SURFACES) {
  const file = path.join(ROOT, "src/landing-static", surface, "index.html");
  if (!fs.existsSync(file)) {
    console.error(`  MISSING ${surface}/index.html`);
    failures += 1;
    continue;
  }
  const bands = bandsOf(fs.readFileSync(file, "utf8"));

  if (REPORT) {
    console.log(`\n${surface}`);
    bands.forEach((b, i) => console.log(`  ${String(i + 1).padStart(2)} ${b.band === "alt" ? "alt " : "base"}  ${b.title}`));
  }

  for (let i = 1; i < bands.length; i += 1) {
    if (bands[i].band !== bands[i - 1].band) continue;
    failures += 1;
    console.error(
      `FAIL ${surface}: "${bands[i - 1].title}" and "${bands[i].title}" both sit on the ` +
        `${bands[i].band} band — the seam between them is not drawn.`,
    );
  }
}

if (failures) {
  console.error(`\n[FAIL] Band guard — ${failures} seam(s) undrawn`);
  process.exit(1);
}
console.log("\n[PASS] Band guard");
