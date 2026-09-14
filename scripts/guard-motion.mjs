#!/usr/bin/env node
/**
 * Motion guard — "no movement without a name".
 *
 * WHY THIS EXISTS. `motion` is one of the ten base token groups the canon
 * declares (RAverse → Дизайн-токены.md → «Базовые группы»), and until
 * 2026-09-09 it was the only one of the ten with nothing behind it in code.
 * What filled the vacuum, measured across src/components + src/app:
 *
 *   · 160ms in 91 places — 51 spelled `0.16s`, 40 spelled `160ms`. One number,
 *     two notations, no name.
 *   · 180ms in 32 more, 140ms in 9, 120ms in 8 — neighbours of 160 that differ
 *     from it only in having been typed on a different day.
 *   · eight distinct cubic-beziers, four of which pair off into two curves
 *     hand-tuned twice (third control point apart by 0.12 and by 0.02).
 *   · `ease` — the browser default, which is the absence of a decision written
 *     out in letters — in 199 places, against 8 for every hand-tuned curve
 *     combined.
 *
 * The landings run the same drift with a different accent: 180ms × 22, and
 * their own ease-out typed `cubic-bezier(.2,.8,.2,1)` fourteen times and
 * `cubic-bezier(.2, .8, .2, 1)` four more.
 *
 * WHY IT IS A RATCHET AND NOT A BAN. A gate that fails on 199 existing sites is
 * a gate nobody can turn on, and rewriting all of them in the pass that
 * introduces the tokens would be a product-wide retiming disguised as a
 * refactor. So this counts per file and holds the line: a file may keep what it
 * has, and may not grow more. New files start at zero. The baseline is a
 * burn-down list, visible to `grep`, not a silencer — every number in it is a
 * literal somebody still has to name.
 *
 * WHAT IS NOT COUNTED, and why each is genuinely different:
 *   · zero (`0s`, `0ms`, `transition: none`) — a refusal to move, not a timing.
 *   · `0.01ms` — the reduced-motion idiom for "finish immediately".
 *   · `linear` — a real choice for a marquee or a progress fill, where any
 *     easing would read as the thing speeding up and slowing down on its own.
 *   · anything already reaching a token (`var(--cw-motion-*)`, `var(--cw-ease-*)`).
 *
 * Usage:
 *   node scripts/guard-motion.mjs             # fail if any file grew
 *   node scripts/guard-motion.mjs --report    # list every literal, per file
 *   node scripts/guard-motion.mjs --baseline  # rewrite the baseline
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const baselineFile = path.join(repoRoot, "data/design-tokens/motion-baseline.json");

const report = process.argv.includes("--report");
const rewriteBaseline = process.argv.includes("--baseline");

/* globals.css and the generated network mirror are where the tokens are
   DEFINED — every literal in them is the answer, not a violation. Tailwind's
   build output and docs/legacy are not authored here. */
const SKIP = [
  "src/app/globals.css",
  "src/landing-static/shared/css/cw-tokens.generated.css",
  "src/landing-static/legacy/",
];

const roots = ["src/components", "src/app", "src/landing-static"];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".css")) out.push(full);
  }
  return out;
}

const rel = (p) => path.relative(repoRoot, p).split(path.sep).join("/");

/* A declaration that times something. `transition`, `animation` and their
   longhands are the whole surface — a `4.7s` inside a `background` gradient
   stop does not exist, but a duration inside a `grid-template` would be a
   parse error anyway, so scoping to these properties costs nothing and stops
   the guard from reading numbers out of content strings. */
const TIMED_PROPERTY =
  /(?:^|[;{])\s*(transition(?:-duration|-delay|-timing-function)?|animation(?:-duration|-delay|-timing-function)?)\s*:([^;}]*)/gi;

const NONZERO_TIME = /(?<![\w.-])(\d+(?:\.\d+)?)(ms|s)(?![\w-])/g;
const BARE_EASE = /(?<![\w-])(ease-in-out|ease-out|ease-in|ease)(?![\w-])/g;

function isMeaningful(value, unit) {
  const ms = unit === "s" ? Number(value) * 1000 : Number(value);
  return ms > 0.02; /* lets 0s, 0ms and the 0.01ms reduced-motion idiom through */
}

function scan(file) {
  const css = fs.readFileSync(file, "utf8");
  const hits = [];
  for (const match of css.matchAll(TIMED_PROPERTY)) {
    /* Blank the token references rather than skipping the whole declaration.
       `transition: color var(--cw-motion-tone) ease` is half named and half
       not, and an early `continue` here let the second half through untouched —
       one token in a declaration would have excused every literal beside it. */
    const value = match[2].replace(/var\(--cw-(?:motion|ease)-[A-Za-z0-9-]*\)/g, " ");
    for (const t of value.matchAll(NONZERO_TIME)) {
      if (isMeaningful(t[1], t[2])) hits.push(t[0]);
    }
    for (const e of value.matchAll(BARE_EASE)) hits.push(e[0]);
  }
  return hits;
}

const counts = new Map();
for (const root of roots) {
  for (const file of walk(path.join(repoRoot, root))) {
    const name = rel(file);
    if (SKIP.some((s) => name === s || name.startsWith(s))) continue;
    const hits = scan(file);
    if (hits.length > 0) counts.set(name, hits);
  }
}

const sorted = [...counts.entries()].sort((a, b) => b[1].length - a[1].length);

if (report) {
  let total = 0;
  for (const [file, hits] of sorted) {
    total += hits.length;
    const tally = new Map();
    for (const h of hits) tally.set(h, (tally.get(h) ?? 0) + 1);
    const summary = [...tally.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([v, n]) => (n > 1 ? `${v}×${n}` : v))
      .join(", ");
    console.log(`${String(hits.length).padStart(4)}  ${file}\n      ${summary}`);
  }
  console.log(`\n${total} unnamed timings across ${sorted.length} files.`);
  process.exit(0);
}

if (rewriteBaseline) {
  const next = { literalTiming: Object.fromEntries(sorted.map(([f, h]) => [f, h.length])) };
  fs.writeFileSync(baselineFile, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  const total = sorted.reduce((n, [, h]) => n + h.length, 0);
  console.log(`[WRITE] baseline → ${rel(baselineFile)} (${total} literals across ${sorted.length} files)`);
  process.exit(0);
}

const baseline = fs.existsSync(baselineFile)
  ? (JSON.parse(fs.readFileSync(baselineFile, "utf8")).literalTiming ?? {})
  : {};

const grew = [];
for (const [file, hits] of sorted) {
  const was = baseline[file] ?? 0;
  if (hits.length > was) grew.push({ file, was, now: hits.length });
}

if (grew.length > 0) {
  console.error("Motion guard: unnamed timings grew.\n");
  for (const g of grew) {
    console.error(`  ${g.file}: ${g.was} → ${g.now}`);
  }
  console.error(
    "\nUse the motion tokens instead of a literal:\n" +
      "  --cw-motion-tap 120ms · --cw-motion-state 160ms · --cw-motion-surface 180ms · --cw-motion-enter 400ms\n" +
      "  --cw-ease-state · --cw-ease-surface · --cw-ease-network\n" +
      'See docs/design-system.md → "Movement". If the new timing is genuinely a\n' +
      "new decision, add it to the token file first, then it stops being a literal.\n" +
      "`node scripts/guard-motion.mjs --baseline` only after that argument is made.",
  );
  process.exit(1);
}

const total = sorted.reduce((n, [, h]) => n + h.length, 0);
const owed = Object.values(baseline).reduce((n, v) => n + v, 0);
console.log(
  `Motion guard: ${total} unnamed timings across ${sorted.length} files, ` +
    `held at baseline (${owed}). No file grew.`,
);
