#!/usr/bin/env node
/**
 * Pointer guard — "hover is a pointer state, and a phone has no pointer".
 *
 * WHY. `:hover` on a touch device does not simply fail to apply. iOS Safari
 * LATCHES it onto the last element tapped and leaves it there until the next
 * tap lands somewhere else. The bug that found this is written out in
 * docs/design-system.md → "Hover is a pointer state": opening the account
 * menu from the cabinet painted TWO gold marks — the full one under «Кабінет»,
 * which is where you are, and a 42% one under whichever row the last tap
 * happened to be near. Two marks in one menu is two answers to «which one am I
 * in», and nothing tells the reader which is the claim and which is residue.
 *
 * `@media (hover: hover)` is the whole fix. A device that cannot hover never
 * paints the hover state, and what is left lit is what is actually true.
 *
 * FOCUS IS NEVER INSIDE THE QUERY. A keyboard has no pointer either, so a
 * `.x:hover, .x:focus-visible` rule must be SPLIT — the hover half moves into
 * the query, the focus half stays out — never wrapped whole. Wrapping it would
 * delete the focus ring on every touch device, which is an accessibility
 * regression wearing a bug fix's clothes. 57 of the 121 hover rules in this
 * codebase were that shape, which is why this guard counts rules rather than
 * trusting a search-and-replace.
 *
 * WHAT IS COUNTED. A rule whose selector contains `:hover` and which does not
 * sit inside a `hover: hover` media query. Nesting inside a width query is
 * fine — `@media (max-width: …) { @media (hover: hover) { … } }` is valid and
 * is what the narrow-viewport rules take.
 *
 * SCOPE is the platform's CSS Modules. The five static landings carry their own
 * skin and their own tap-highlight handling; they are counted separately so a
 * landing cannot hide behind the platform's number.
 *
 * Usage:
 *   node scripts/guard-pointer.mjs             # fail if any file grew
 *   node scripts/guard-pointer.mjs --report    # list every unguarded rule
 *   node scripts/guard-pointer.mjs --baseline  # rewrite the baseline
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const baselineFile = path.join(repoRoot, "data/design-tokens/pointer-baseline.json");

const report = process.argv.includes("--report");
const rewriteBaseline = process.argv.includes("--baseline");

const SKIP = ["src/landing-static/legacy/"];

const SCOPES = [
  { key: "platform", root: "src/components" },
  { key: "app", root: "src/app" },
  { key: "network", root: "src/landing-static" },
];

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

/* Ranges of every `hover: hover` media block, so a rule inside one is known to
   be guarded however deeply it is nested. Brace-matched rather than
   line-matched: these queries wrap multi-rule blocks. */
function guardedRanges(css) {
  const ranges = [];
  const re = /@media[^{]*hover\s*:\s*hover[^{]*\{/g;
  let m;
  while ((m = re.exec(css))) {
    let i = re.lastIndex;
    let depth = 1;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }
    ranges.push([m.index, i]);
  }
  return ranges;
}

/* Comments are blanked, not stripped, before anything is matched — every char
   replaced by a space except newlines, so line numbers survive. Without this
   the scan reads prose: this codebase argues about hover IN COMMENTS, at
   length, and five of its most carefully reasoned blocks — including the very
   one that documents the latch bug — were reported as violations of the rule
   they were explaining. A guard that cannot tell an argument from a selector
   will be switched off by the first person it accuses wrongly. */
function blankComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
}

function scan(file) {
  const css = blankComments(fs.readFileSync(file, "utf8"));
  const ranges = guardedRanges(css);
  const unguarded = [];
  for (const m of css.matchAll(/([^{}]*?):hover\b([^{}]*?)\{/g)) {
    if (ranges.some(([a, b]) => m.index >= a && m.index < b)) continue;
    const selector = `${m[1]}:hover${m[2]}`.trim().replace(/\s+/g, " ");
    if (selector.startsWith("@")) continue; /* an at-rule prelude, not a rule */
    const line = css.slice(0, m.index).split("\n").length;
    unguarded.push({ line, selector });
  }
  return unguarded;
}

/* THE OTHER HALF OF THE SAME QUESTION.
   Gating hover removed a state that was lying on touch. It did not add the one
   that was missing: at the time this was written 153 selectors in the platform
   could paint a hover and 12 could paint a press, so on a finger the great
   majority of the product received a gesture and said nothing.

   This is a REPORT and not a gate, and the difference is deliberate. Whether a
   given object answers a press is a design decision per object — a card
   settles, a dot runs to full, a transparent control has nothing to push down
   and answers with ink instead — and a number that fails the build would be
   answered by whatever silences it fastest. What it does is keep the remainder
   countable, so «which controls are still silent under a thumb» is one command
   rather than an afternoon.

   It cannot see cross-file coverage: an ink-carrying control answers through
   the shared `:is(.cw-tab, .cw-nav-link, [data-cw-ink-control]):active` family
   in globals.css, which no per-file scan can attribute. So this over-reports,
   and says so, rather than quietly claiming a number it cannot stand behind.
   The honest count comes from the browser — see the note in
   docs/design-system.md → "Press is the state a finger has". */
function pressGap(file) {
  const css = blankComments(fs.readFileSync(file, "utf8"));
  const key = (sel) =>
    sel
      .replace(/:(?:hover|active)\b/g, "")
      .replace(/:not\([^)]*\)/g, "")
      .trim();
  const hover = new Set();
  const press = new Set();
  for (const m of css.matchAll(/([^{}]+?)\{/g)) {
    const prelude = m[1].trim();
    if (prelude.startsWith("@")) continue;
    for (const part of prelude.split(",")) {
      const sel = part.trim();
      if (/:hover\b/.test(sel)) hover.add(key(sel));
      if (/:active\b/.test(sel)) press.add(key(sel));
    }
  }
  return [...hover].filter((h) => !press.has(h));
}

const found = new Map(); /* scope -> Map(file -> rules[]) */
for (const { key, root } of SCOPES) {
  const perFile = new Map();
  for (const file of walk(path.join(repoRoot, root))) {
    const name = rel(file);
    if (SKIP.some((s) => name === s || name.startsWith(s))) continue;
    const rules = scan(file);
    if (rules.length > 0) perFile.set(name, rules);
  }
  found.set(key, perFile);
}

/* TAILWIND IS NOT CHECKED HERE (2026-09-14). The version of this guard written
   on 2026-09-10 also asserted `future.hoverOnlyWhenSupported` in
   tailwind.config.js, because Tailwind `hover:` variants live in TSX class names
   and no CSS scan can see them. This repository no longer has a Tailwind config,
   so that check had nothing to read and was removed rather than left as a branch
   that never runs. */

const flat = [...found].flatMap(([scope, perFile]) => [...perFile].map(([file, rules]) => ({ scope, file, rules })));
flat.sort((a, b) => b.rules.length - a.rules.length);

if (report) {
  let total = 0;
  for (const { scope, file, rules } of flat) {
    total += rules.length;
    console.log(`${String(rules.length).padStart(4)}  [${scope}] ${file}`);
    for (const r of rules) console.log(`        :${r.line}  ${r.selector}`);
  }
  console.log(`\n${total} unguarded hover rules across ${flat.length} files.`);

  const gaps = [];
  for (const { root } of SCOPES) {
    for (const file of walk(path.join(repoRoot, root))) {
      const name = rel(file);
      if (SKIP.some((s) => name === s || name.startsWith(s))) continue;
      const missing = pressGap(file);
      if (missing.length > 0) gaps.push({ file: name, missing });
    }
  }
  gaps.sort((a, b) => b.missing.length - a.missing.length);
  const owed = gaps.reduce((n, g) => n + g.missing.length, 0);
  console.log(`\n── press gap (report only, over-reports across files) ──\n`);
  for (const g of gaps.slice(0, 15)) {
    console.log(`${String(g.missing.length).padStart(4)}  ${g.file}`);
    console.log(`        ${g.missing.slice(0, 3).join(" · ")}`);
  }
  console.log(
    `\n${owed} selectors can paint a hover and have no press rule in the same file.\n` +
      "Some answer through the shared ink family in globals.css, which this cannot see.",
  );
  process.exit(0);
}

if (rewriteBaseline) {
  const next = {};
  for (const [scope, perFile] of found) {
    next[scope] = Object.fromEntries(
      [...perFile].sort((a, b) => b[1].length - a[1].length).map(([f, r]) => [f, r.length]),
    );
  }
  fs.writeFileSync(baselineFile, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  const total = flat.reduce((n, f) => n + f.rules.length, 0);
  console.log(`[WRITE] baseline → ${rel(baselineFile)} (${total} unguarded rules)`);
  process.exit(0);
}

const baselineJson = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, "utf8")) : {};

const grew = [];
for (const { scope, file, rules } of flat) {
  const was = baselineJson[scope]?.[file] ?? 0;
  if (rules.length > was) grew.push({ file, was, now: rules.length });
}

if (grew.length > 0) {
  console.error("Pointer guard: unguarded hover rules grew.\n");
  for (const g of grew) console.error(`  ${g.file}: ${g.was} → ${g.now}`);
  console.error(
    "\nWrap the hover half in `@media (hover: hover)`. If the rule also carries\n" +
      "`:focus-visible` or `:active`, SPLIT it — those two must stay outside the\n" +
      "query, because a keyboard has no pointer either.\n" +
      'See docs/design-system.md → "Hover is a pointer state" (2026-09-10).',
  );
  process.exit(1);
}

const total = flat.reduce((n, f) => n + f.rules.length, 0);
console.log(
  total === 0
    ? "Pointer guard: every hover rule is behind `@media (hover: hover)`."
    : `Pointer guard: ${total} unguarded hover rules across ${flat.length} files, held at baseline.`,
);
