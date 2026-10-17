#!/usr/bin/env node
/**
 * Scrollbar guard — "the bar is the design system's, never the system's".
 *
 * WHY. The DS scrollbar used to be opt-in: three classes (`cw-scroll`,
 * `cw-scroll-rail`, `cw-scroll-none`) that a scroll container had to remember
 * to wear. Every one that forgot — a textarea, a modal body, the page — drew
 * the operating system's bar, arrows included. The recipe is now the floor in
 * globals.css (`:where(*)` plus a `*::-webkit-scrollbar` set), so nothing can
 * forget it. This guard keeps it that way, from both ends:
 *
 *   1. The floor is still there: the universal standard rule and the universal
 *      webkit rules exist in globals.css.
 *   2. Nothing else repaints a bar. `scrollbar-color`, `scrollbar-width` and
 *      every `::-webkit-scrollbar*` selector belong to globals.css. A module
 *      that needs no bar writes `composes: cw-scroll-none from global`; one that
 *      needs a thin rail writes `composes: cw-scroll-rail from global`. A
 *      private recipe is how seven modules once drifted apart.
 *   3. Nothing opts back out to the system's bar: `scrollbar-width: auto` and
 *      `scrollbar-color: auto` are refused everywhere.
 *
 * SCOPE is the platform: src/app and src/components. The static landings carry
 * their own skin and are not part of this contract.
 *
 * Usage:
 *   node scripts/guard-scrollbars.mjs
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const GLOBALS = "src/app/globals.css";
const ROOTS = ["src/app", "src/components"];

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
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

const failures = [];

const globals = stripComments(fs.readFileSync(path.join(repoRoot, GLOBALS), "utf8"));
const floor = [
  [
    /:where\(\s*\*\s*\)\s*\{[^}]*scrollbar-width\s*:\s*thin[^}]*scrollbar-color\s*:/,
    "`:where(*)` with scrollbar-width: thin and scrollbar-color",
  ],
  [/(^|[\s,}])\*::-webkit-scrollbar\s*\{/m, "`*::-webkit-scrollbar`"],
  [/(^|[\s,}])\*::-webkit-scrollbar-thumb\s*\{/m, "`*::-webkit-scrollbar-thumb`"],
  [/(^|[\s,}])\*::-webkit-scrollbar-button\s*\{[^}]*display\s*:\s*none/m, "`*::-webkit-scrollbar-button` hidden"],
];
for (const [re, label] of floor) {
  if (!re.test(globals)) failures.push(`${GLOBALS}: the scrollbar floor lost ${label}`);
}

for (const root of ROOTS) {
  for (const file of walk(path.join(repoRoot, root))) {
    const name = rel(file);
    const css = stripComments(fs.readFileSync(file, "utf8"));
    const lines = css.split("\n");
    lines.forEach((line, i) => {
      if (/scrollbar-width\s*:\s*auto|scrollbar-color\s*:\s*auto/.test(line)) {
        failures.push(`${name}:${i + 1}: opts back to the system scrollbar (${line.trim()})`);
      }
      if (name !== GLOBALS && /scrollbar-(width|color)\s*:|::-webkit-scrollbar/.test(line)) {
        failures.push(
          `${name}:${i + 1}: writes its own scrollbar (${line.trim()}) — compose cw-scroll-none / cw-scroll-rail from global instead`,
        );
      }
    });
  }
}

if (failures.length) {
  console.error("Scrollbar guard failed:\n" + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
console.log("Scrollbar guard: the DS bar is the floor, and nothing else paints one.");
