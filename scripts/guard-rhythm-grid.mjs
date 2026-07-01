import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DEFAULT_TARGET = path.join(ROOT, "src", "landing-static", "shared", "css", "funnel-network.css");
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

async function main() {
  const target = process.argv[2] ? path.resolve(ROOT, process.argv[2]) : DEFAULT_TARGET;
  const raw = await fs.readFile(target, "utf8");
  const lines = raw.split(/\r?\n/);
  const violations = [];

  lines.forEach((line, idx) => {
    const match = line.match(RHYTHM_PROP_RE);
    if (!match) return;

    const value = match[1];
    const units = Array.from(value.matchAll(UNIT_VALUE_RE));
    for (const entry of units) {
      const [, rawNum, unit] = entry;
      const px = toPx(rawNum, unit);
      if (px === null) continue;
      if (!isMultipleOfStep(px)) {
        violations.push({
          line: idx + 1,
          value: `${rawNum}${unit}`,
          px,
          source: line.trim(),
        });
      }
    }
  });

  if (violations.length > 0) {
    console.error(`Rhythm grid guard failed (${violations.length}): expected multiples of ${STEP_PX}px`);
    for (const item of violations) {
      console.error(`  L${item.line}: ${item.value} (${item.px}px) -> ${item.source}`);
    }
    process.exit(1);
  }

  console.log(`Rhythm grid guard OK (${path.relative(ROOT, target)}): all rhythm values are multiples of ${STEP_PX}px`);
}

main().catch((error) => {
  console.error("Rhythm grid guard crashed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
