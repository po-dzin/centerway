/**
 * The landing network's vertical rhythm: spacing values land on a 4px grid.
 *
 * A RATCHET, NOT A LINE IN THE SAND, and the history is the argument. This
 * guard has never once been green. Measured against its own target across the
 * commits that touched it: 40 violations in July, then 38, then 14, then 8,
 * then the 9 it has today. Somebody has been grinding the number down for two
 * months while the gate stayed red the whole time and therefore never ran in
 * CI — which is the same failure mode `verify-guards.mjs` was written to end.
 *
 * A gate that is red on arrival teaches one thing: ignore the gate. So it now
 * fails on the NEXT off-grid value rather than on the ones already counted,
 * exactly as `guard:geometry` does for radius, spacing and type. The count
 * lives in data/design-tokens/rhythm-baseline.json where it can be read,
 * lowered, and argued with.
 *
 * WHAT IS LEFT, and why none of it is obviously wrong: the nine are `2.4rem`,
 * `3.2rem`, `1.7rem`, `2.6rem`, `1.3rem` and three `0.625rem`. Every one is a
 * round number in rem and an odd one in px, and six of them are the floor or
 * the ceiling of a `clamp()` whose middle term is a `vw` — so the value that
 * actually renders is fluid and lands on no grid at any viewport. Snapping them
 * would move live pages by a pixel and a half to satisfy an arithmetic the
 * rendered page does not obey. That is a design decision about whether the grid
 * is stated in rem or in px, and it is not this guard's to make.
 *
 * Usage:
 *   node scripts/guard-rhythm-grid.mjs                 # check against the baseline
 *   node scripts/guard-rhythm-grid.mjs --baseline      # record the current count
 *   node scripts/guard-rhythm-grid.mjs path/to.css     # check another sheet
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DEFAULT_TARGET = path.join(ROOT, "src", "landing-static", "shared", "css", "funnel-network.css");
const BASELINE_FILE = path.join(ROOT, "data", "design-tokens", "rhythm-baseline.json");
const STEP_PX = 4;

const RHYTHM_PROP_RE =
  /^\s*(?:--cw3-space(?:-[\w.]+)?|--cw3-(?:section-space-y|flow-block-space|entry-title-gap|entry-cta-gap)|(?:margin|padding|gap|top|bottom|left|right)(?:-(?:top|right|bottom|left))?|(?:column-gap|row-gap))\s*:\s*([^;]+);/;

const UNIT_VALUE_RE = /(-?\d*\.?\d+)\s*(rem|px)\b/g;

function isMultipleOfStep(px) {
  const ratio = px / STEP_PX;
  return Math.abs(ratio - Math.round(ratio)) < 1e-8;
}

function toPx(rawValue, unit) {
  const numeric = Number.parseFloat(rawValue);
  if (!Number.isFinite(numeric)) return null;
  if (unit === "px") return numeric;
  if (unit === "rem") return numeric * 16;
  return null;
}

function collectViolations(raw) {
  const violations = [];
  raw.split(/\r?\n/).forEach((line, idx) => {
    const match = line.match(RHYTHM_PROP_RE);
    if (!match) return;
    for (const [, rawNum, unit] of match[1].matchAll(UNIT_VALUE_RE)) {
      const px = toPx(rawNum, unit);
      if (px === null || isMultipleOfStep(px)) continue;
      violations.push({ line: idx + 1, value: `${rawNum}${unit}`, px, source: line.trim() });
    }
  });
  return violations;
}

async function readBaseline() {
  try {
    return JSON.parse(await fs.readFile(BASELINE_FILE, "utf8"));
  } catch {
    return {};
  }
}

async function main() {
  const rewrite = process.argv.includes("--baseline");
  const explicit = process.argv.slice(2).find((argument) => !argument.startsWith("-"));
  const target = explicit ? path.resolve(ROOT, explicit) : DEFAULT_TARGET;
  const rel = path.relative(ROOT, target);

  const violations = collectViolations(await fs.readFile(target, "utf8"));
  const baseline = await readBaseline();
  const allowed = baseline[rel] ?? 0;

  if (rewrite) {
    const next = { ...baseline, [rel]: violations.length };
    if (violations.length === 0) delete next[rel];
    await fs.writeFile(BASELINE_FILE, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`[WRITE] rhythm baseline → ${path.relative(ROOT, BASELINE_FILE)}: ${rel} = ${violations.length}`);
    return;
  }

  if (violations.length > allowed) {
    console.error(
      `Rhythm grid guard failed: ${violations.length} off-grid values in ${rel}, ` +
        `${violations.length - allowed} more than the baseline of ${allowed}. Expected multiples of ${STEP_PX}px.`,
    );
    for (const item of violations) {
      console.error(`  L${item.line}: ${item.value} (${item.px}px) -> ${item.source}`);
    }
    console.error(
      "\nPut the new value on the grid. If it genuinely cannot go there, say why in the CSS and\n" +
        "raise the baseline deliberately with `node scripts/guard-rhythm-grid.mjs --baseline`.",
    );
    process.exit(1);
  }

  if (violations.length < allowed) {
    console.log(
      `Rhythm grid guard OK (${rel}): ${violations.length} off-grid, down from a baseline of ${allowed}. ` +
        "Lower it with `--baseline` so the ground you gained cannot be given back.",
    );
    return;
  }

  if (allowed === 0) {
    console.log(`Rhythm grid guard OK (${rel}): every rhythm value is a multiple of ${STEP_PX}px.`);
    return;
  }

  console.log(`Rhythm grid guard OK (${rel}): ${violations.length} off-grid, all of them known. Nothing new.`);
}

main().catch((error) => {
  console.error("Rhythm grid guard crashed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
