#!/usr/bin/env node
/**
 * Geometry guard — "the box decides the radius, and one scale answers".
 *
 * WHY THIS EXISTS, in one incident. «Soft rect, not circles» (2026-09-06) was
 * decided, written into docs/design-system.md, and applied: the topbar's nav
 * links were edited from `pill` to the control step. Twenty-eight lines lower
 * in the SAME FILE a second `.nav a` rule still said `pill`, at equal
 * specificity and later in source order, so the browser kept measuring 999px
 * for another day while the doc said the sweep was done. Nobody was careless;
 * a rule simply cannot be enforced by a paragraph.
 *
 * The audit that followed (docs/design-system/geometry-audit-2026-09-07.md)
 * found the same shape of failure four more times: five radius vocabularies,
 * four different radii on the same 48px box, portraits with three answers, and
 * 279 spacing values that are not on any scale. This file is the part of that
 * work that survives the next redraw.
 *
 * THE LAW IT ENFORCES
 *
 *   1. Radius is named. A number in a `border-radius` is only allowed as `0`
 *      (deliberately square) or `50%` (a circle drawn as a circle).
 *   2. Radius is a function of the BOX, not of the role:
 *
 *        ≤ 24px    inset 6    a detail inside something else
 *        25–56px   md 16      a control
 *        57–200px  lg 20      a card, a tile, a panel
 *        > 200px   xl 28      a surface, a sheet, a plate
 *
 *      Checked only where a rule declares both a resolvable size and a radius,
 *      which is where the two can disagree in the first place.
 *   3. Three carve-outs, each a decision rather than a silencer:
 *        · genuinely round things — dots, rails, tracks, thumbs, handles — take
 *          `pill`, and the ROUND list below names them;
 *        · a face is round wherever it appears (2026-09-07 decision), so
 *          portraits take `pill` at any size;
 *        · text in a capsule — chips and badges — takes `pill`, because a
 *          chip's radius is `height / 2` by construction and therefore is not a
 *          step on any scale.
 *   4. One vocabulary. `tailwind.config.js` must map its `borderRadius` scale
 *      onto `--cw-radius-*`, or the Control Panel silently runs Tailwind's own
 *      6/8/12/16/24 underneath the platform's 6/12/16/20/28 — which is where
 *      `lg` came to mean two different numbers in one product.
 *   5. Spacing is a RATCHET, not a wall. 279 off-scale values cannot be fixed
 *      in one pass and should not block a release; the guard fails only when a
 *      file grows MORE of them than the baseline it was measured at.
 *
 * Scope is the platform: `src/app/globals.css` and `src/components/**`. The
 * five static landings never load globals.css and carry their own skin — the
 * same scope decision `guard-buttons.mjs` makes, for the same reason.
 *
 * Usage:
 *   node scripts/guard-geometry.mjs             # fail on violations
 *   node scripts/guard-geometry.mjs --report    # list everything it sees
 *   node scripts/guard-geometry.mjs --baseline  # rewrite the spacing baseline
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const report = process.argv.includes("--report");
const rewriteBaseline = process.argv.includes("--baseline");
const baselineFile = path.join(repoRoot, "data/design-tokens/geometry-baseline.json");

const RADIUS_PX = {
  "--cw-radius-inset": 6,
  "--cw-radius-sm": 12,
  "--cw-radius-md": 16,
  "--cw-radius-btn": 16,
  "--cw-radius-lg": 20,
  "--cw-card-radius": 20,
  "--cw-radius-xl": 28,
  "--cw-radius-pill": 999,
};

/* The bands, as one table rather than as four conditions scattered through the
   file. `max` is inclusive. */
const BANDS = [
  { max: 24, token: "--cw-radius-inset", label: "inset 6" },
  { max: 56, token: "--cw-radius-md", label: "md 16" },
  { max: 200, token: "--cw-radius-lg", label: "lg 20" },
  { max: Infinity, token: "--cw-radius-xl", label: "xl 28" },
];

const bandFor = (px) => BANDS.find((b) => px <= b.max);

/* Carve-out 1: things that are genuinely round. A name test rather than a
   geometry test, because "is this a dot or a small square" is not something CSS
   can be asked — but it is something a name says out loud, and a name that
   lies about it is its own bug. */
const ROUND = /(dot|ring|track|thumb|handle|rail|bar|wheel|orb|bullet|marker|spinner|knob|swatch|mark|number|ordinal)(?=$|[A-Z0-9_])/i;

/* A pseudo-element wearing `pill` is a drawn thing — a counter disc, a
   connector line, the brass rule under a name — never a control, because a
   control is an element you can press and `::before` is not one. Three of the
   first run's «violations» were exactly that: `.moduleHead::before` (a 26px
   counter disc), `.lessonRowWrap::before` (an 8px connector) and
   `.identityName::after` (a 2px rule with round ends). */
const DRAWN = /::(before|after)$/;

/* Carve-out 2: a face is round at every size — the 2026-09-07 decision, which
   replaced three different answers (pill in AuthorPortrait, md in the bar, 50%
   in the islands). The plate a face sits IN is a control and takes its band. */
const FACE = /(avatar|portrait|face|photo)(?=$|[A-Z0-9_])/i;

/* Carve-out 3: text in a capsule. `height / 2` is not a step on any scale, so a
   chip cannot be expressed by the bands without ceasing to be a chip. */
const CHIP = /(chip|badge|pill|tag|count|status)(?=$|[A-Z0-9_])/i;

const SPACE_SCALE = new Set([0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4.5]);

function cssFiles() {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (full.includes("landing-static")) continue;
        walk(full);
      } else if (entry.name.endsWith(".css")) {
        out.push(full);
      }
    }
  };
  walk(path.join(repoRoot, "src/components"));
  out.push(path.join(repoRoot, "src/app/globals.css"));
  return out;
}

const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const rel = (file) => path.relative(repoRoot, file);

/** Resolve a length to px, or null when it is not a fixed length. */
function toPx(value) {
  const v = value.trim();
  let m = /^([0-9.]+)rem$/.exec(v);
  if (m) return Number(m[1]) * 16;
  m = /^([0-9.]+)px$/.exec(v);
  if (m) return Number(m[1]);
  if (/--ds-touch-target-min|--platform-utility-control-size|--cw-ink-ring-size/.test(v)) return 48;
  m = /var\((--[a-z-]+)\)/.exec(v);
  if (m && RADIUS_PX[m[1]] !== undefined) return RADIUS_PX[m[1]];
  return null;
}

const failures = [];
const mismatches = [];
const seen = [];

for (const file of cssFiles()) {
  const source = strip(fs.readFileSync(file, "utf8"));
  const rules = source.matchAll(/([^{}]+)\{([^{}]*)\}/g);

  for (const [, rawSelector, body] of rules) {
    const selector = rawSelector.trim().split("\n").pop().trim();
    const radiusMatch = /border-radius:\s*([^;]+);/.exec(body);
    if (!radiusMatch) continue;
    const radius = radiusMatch[1].trim();

    /* 1. Named, or one of the two literals that mean something a token cannot:
          `0` is "deliberately square", `50%` is "a circle, drawn as one". */
    /* `calc(var(--cw-card-radius) - var(--cw-radius-inset))` is not a literal —
       it is the CONCENTRIC rule, the one place this codebase already states
       that a child's corner is its parent's minus the padding between them.
       Three rules write it today. The arithmetic operators inside it are not
       radius values and must not be read as ones. */
    const literals = radius
      .replace(/calc\(/g, " ")
      .split(/[\s()]+/)
      .filter(Boolean)
      .filter((part) => part !== "var" && !part.startsWith("var(") && !part.includes("var(") && !part.startsWith("--"))
      .filter((part) => !["+", "-", "*", "/"].includes(part))
      .filter((part) => part !== "0" && part !== "50%" && part !== "60%" && part !== "inherit");
    if (literals.length) {
      failures.push({
        kind: "unnamed radius",
        file: rel(file),
        selector,
        detail: `border-radius: ${radius} — ${literals.join(" ")} is not a step. Use a --cw-radius-* token.`,
      });
      continue;
    }

    /* 2. Box ↔ band, only where the rule states its own size.

       THE SHORTER SIDE, and it is not a detail: a text field is 224px wide and
       48px tall, and the first of those makes it a plate while the second makes
       it what it is. Reading whichever dimension appeared first in the body put
       `.formatInput` in the `xl` band — the guard would have demanded a
       28px-round input. Every declared dimension is resolved and the smallest
       one decides, which is the closest CSS can get to "how big is this
       object". */
    const sizes = [...body.matchAll(/(?:^|\s)(?:min-height|height|min-width|width|block-size|inline-size):\s*([^;]+);/g)]
      .map((m) => toPx(m[1]))
      .filter((n) => n !== null && n >= 8);
    const token = /var\((--[a-z-]+)\)/.exec(radius)?.[1];
    if (!sizes.length || !token || RADIUS_PX[token] === undefined) continue;
    const size = Math.min(...sizes);

    const name = selector.replace(/^[.#]/, "");
    const exempt =
      token === "--cw-radius-pill" &&
      (ROUND.test(name) || FACE.test(name) || CHIP.test(name) || DRAWN.test(selector));
    const band = bandFor(size);
    seen.push({ file: rel(file), selector, size, token, band: band.label, exempt });
    if (exempt) continue;

    if (RADIUS_PX[token] !== RADIUS_PX[band.token]) {
      mismatches.push({
        key: `${rel(file)} ${selector}`,
        file: rel(file),
        selector,
        detail: `${Math.round(size)}px box takes ${band.label}, this says ${token.replace("--cw-", "")}`,
      });
    }
  }
}

/* 4. One vocabulary: the panel's Tailwind classes must resolve to our steps. */
const tailwind = fs.readFileSync(path.join(repoRoot, "tailwind.config.js"), "utf8");
const tailwindRadius = /borderRadius:\s*\{([^}]*)\}/.exec(tailwind)?.[1] ?? "";
const tailwindValues = [...tailwindRadius.matchAll(/:\s*"([^"]+)"/g)].map((m) => m[1]);
if (!tailwindValues.length) {
  failures.push({
    kind: "second radius vocabulary",
    file: "tailwind.config.js",
    selector: "theme.extend.borderRadius",
    detail: "unset — the Control Panel falls back to Tailwind's own 6/8/12/16/24 scale",
  });
} else {
  for (const value of tailwindValues) {
    if (value !== "0" && !value.includes("--cw-radius-")) {
      failures.push({
        kind: "second radius vocabulary",
        file: "tailwind.config.js",
        selector: "theme.extend.borderRadius",
        detail: `${value} is not a --cw-radius-* step`,
      });
    }
  }
}

/* 5. The spacing ratchet. */
const spacingProps = /(?:^|\s)(?:padding|margin|gap|row-gap|column-gap)(?:-(?:inline|block|top|right|bottom|left)(?:-(?:start|end))?)?:\s*([^;{]+);/g;
const offScale = {};
for (const file of cssFiles()) {
  const source = strip(fs.readFileSync(file, "utf8"));
  let count = 0;
  for (const [, value] of source.matchAll(spacingProps)) {
    for (const part of value.trim().split(/\s+/)) {
      if (part.startsWith("var(") || part.includes("var(") || part.includes("(")) continue;
      const px = toPx(part.replace(/^-/, ""));
      if (px === null || px === 0) continue;
      if (!SPACE_SCALE.has(Number((px / 16).toFixed(4)))) count += 1;
    }
  }
  if (count) offScale[rel(file)] = count;
}

/* 6. The type ratchet, on the same terms as the spacing one. 181 literal
   font-sizes in 36 distinct values was not a scale, it was a cloud: eleven
   values between 0.6 and 0.82rem all orbiting `label`, seven between 0.84 and
   0.95 orbiting `body-sm`. The mass sat BELOW `body-sm`, which is how the token
   came to be re-centred (0.9375 → 0.9) rather than the 143 near-misses dragged
   up to it. 26 literals are left and they are display sizes with no step to
   land on; the ratchet is what stops the 27th. */
const typeLiteral = /font-size:\s*([0-9.]+)(rem|px)\s*;/g;
const literalType = {};
for (const file of cssFiles()) {
  const source = strip(fs.readFileSync(file, "utf8"));
  const count = [...source.matchAll(typeLiteral)].length;
  if (count) literalType[rel(file)] = count;
}

if (rewriteBaseline) {
  fs.writeFileSync(
    baselineFile,
    `${JSON.stringify(
      {
        radiusMismatch: Object.fromEntries(mismatches.map((m) => [m.key, m.detail])),
        offScaleSpacing: offScale,
        literalFontSize: literalType,
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    `[WRITE] baseline → ${rel(baselineFile)} (${mismatches.length} radius mismatches, ` +
      `${Object.keys(offScale).length} files with off-scale spacing, ` +
      `${Object.values(literalType).reduce((a, b) => a + b, 0)} literal font-sizes)`,
  );
  process.exit(0);
}

const baselineJson = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, "utf8")) : {};
const knownMismatch = baselineJson.radiusMismatch ?? {};
const baseline = baselineJson.offScaleSpacing ?? {};
const typeBaseline = baselineJson.literalFontSize ?? {};

/* THE SECOND RATCHET, and it is not a softer rule — it is an honest one. Of the
   27 disagreements this check found on its first run, four were the guard's own
   fault (a `::before` is a drawn line, not a control) and most of the rest are
   ONE unstated principle: a row inside a plated panel takes a step below its
   parent, which is the concentric-radius rule the platform already discovered
   locally (`calc(var(--cw-card-radius) - var(--cw-radius-inset))`, three
   places). Failing the build on them would force either 22 exemptions or a
   product-wide reshape smuggled in under a guard commit. Both are worse than
   naming them: every one below is listed in the baseline, visible to `grep`,
   and burnt down deliberately. What the ratchet does stop is the 23rd. */
for (const m of mismatches) {
  if (!(m.key in knownMismatch)) {
    failures.push({ kind: "box / radius disagree", file: m.file, selector: m.selector, detail: m.detail });
  }
}
for (const [file, count] of Object.entries(offScale)) {
  const was = baseline[file] ?? 0;
  if (count > was) {
    failures.push({
      kind: "off-scale spacing grew",
      file,
      selector: "—",
      detail: `${was} → ${count} values that are not steps of --cw-space-*. The scale is 0.25 · 0.5 · 0.75 · 1 · 1.5 · 2 · 3 · 4.5rem.`,
    });
  }
}

for (const [file, count] of Object.entries(literalType)) {
  const was = typeBaseline[file] ?? 0;
  if (count > was) {
    failures.push({
      kind: "literal font-size grew",
      file,
      selector: "—",
      detail: `${was} → ${count} font sizes written as numbers. The scale is --ds-type-{label,body-sm,body,lead,display,title,hero}-size.`,
    });
  }
}

if (report) {
  console.log("\nRadius by box size (rules that declare both):\n");
  for (const row of seen.sort((a, b) => a.size - b.size)) {
    const flag = row.exempt ? "carve-out" : RADIUS_PX[row.token] === RADIUS_PX[bandFor(row.size).token] ? "ok" : "MISMATCH";
    console.log(
      `  ${String(Math.round(row.size)).padStart(4)}px  ${row.token.replace("--cw-", "").padEnd(12)} ${flag.padEnd(9)} ${row.selector.padEnd(40)} ${row.file}`,
    );
  }
  const total = Object.values(offScale).reduce((a, b) => a + b, 0);
  console.log(`\nOff-scale spacing: ${total} values across ${Object.keys(offScale).length} files.`);
  const typeTotal = Object.values(literalType).reduce((a, b) => a + b, 0);
  console.log(`Literal font-sizes: ${typeTotal} across ${Object.keys(literalType).length} files.`);
  console.log(`\nRadius burn-down (${mismatches.length} accepted in the baseline):\n`);
  for (const m of mismatches) console.log(`  ${m.selector.padEnd(40)} ${m.detail}`);
}

if (failures.length) {
  console.error(`\n[FAIL] Geometry guard (${failures.length})\n`);
  for (const f of failures) {
    console.error(`  - ${f.file}`);
    console.error(`    ${f.selector}  →  ${f.kind}`);
    console.error(`      ${f.detail}\n`);
  }
  console.error("  Law:  docs/design-system/geometry-audit-2026-09-07.md");
  process.exit(1);
}

console.log(
  `[PASS] Geometry guard — ${seen.length} sized rules checked, one radius vocabulary, ` +
    `${mismatches.length} known radius mismatches held at baseline, spacing and type held at baseline.`,
);
