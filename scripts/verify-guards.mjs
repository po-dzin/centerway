/**
 * Every check that reads the repository and decides, in one run.
 *
 * WHY THIS FILE EXISTS. Each gate below already existed and each was green on
 * the day it was written — and none ran unless somebody typed the command.
 * That is not hypothetical: «soft rect, not circles» was decided, applied,
 * documented, and then silently undone by a second rule in the same file, and
 * the product drew pills for another day while the doc said otherwise. A guard
 * nobody runs is a paragraph with a shebang.
 *
 * The list lived in `.github/workflows/design-gates.yml` as fifteen named
 * steps. It is here now for one reason: a list that exists only in CI is a list
 * a person cannot run before pushing, and two copies of it drift. CI calls this
 * script; so can you (`npm run verify:guards`).
 *
 * Nothing here needs a network, a server, or a secret — that is the entry
 * condition. A check that calls a running app is a smoke and belongs in
 * `verify:admin` or `verify:landing`.
 *
 * Unlike a sequence of CI steps, this does NOT stop at the first failure: it
 * runs everything and reports every broken gate at the end, because finding out
 * about the second one on the next push is a waste of a run.
 */

import { spawnSync } from "node:child_process";

const only = process.argv.slice(2).filter((argument) => !argument.startsWith("-"));

/*
 * NOT IN THIS LIST, and each for a reason, so the list does not read as
 * complete when it is not (all four were failing on 2026-09-11):
 *
 *   icons:check         the sprite and src/lib/brand/iconNames.ts no longer
 *                       match what icons-bake produces — a glyph changed
 *                       without a rebake.
 *   guard:carriers      way21's "how" block carries a photo and an arrow icon
 *                       at once, which is what that guard exists to refuse.
 *   guard:rhythm        off-grid values in the landing network CSS.
 *   generator:language  broken, not failing: it pulls "string literals" out of
 *                       TSX with a regex, swallows a JSX block, and reports
 *                       every Latin word inside it as mixed language.
 *
 * Add one back the moment it is green. A red gate kept out of the runner is
 * a gate nobody will ever fix.
 */

/** `npm run <script>` — with the reason it exists, where the reason is not obvious. */
const gates = [
  {
    script: "format:check",
    title: "Formatting is Prettier's",
    // The repo was formatted in one pass on 2026-09-11. Without this line the
    // next hand-wrapped line starts the drift back, one file at a time.
  },
  {
    script: "tokens:check",
    title: "Tokens are generated, not typed",
    // Regenerates from cw.tokens.json and fails if globals.css moves. The one
    // check that catches a hand-edit inside a marker block, which is invisible
    // in review and is silently reverted by the next build.
  },
  {
    script: "ds:sync:check",
    title: "DS bundle in sync with the tokens",
    // The mirror bundle is derived from the same JSON. Out of sync means the
    // Claude Design project is being shown a system this repo no longer ships.
  },
  {
    script: "ds:drift:gate",
    title: "Code and mirror agree on every shared token",
    // Gated on CONFLICTS only — a token whose value differs between the two.
    // One-sided entries are expected and listed in design.drift.json.
  },
  {
    script: "guard:eslint",
    title: "ESLint guard rules still bite",
    // `lint` proves the code is clean; this proves the rules would have said so.
  },
  { script: "guard:canon", title: "Platform canon" },
  { script: "guard:assets", title: "Assets referenced exist" },
  { script: "brand:check", title: "Brand mark" },
  { script: "guard:ds-contract", title: "Shared DS contract" },
  { script: "guard:contrast", title: "Contrast" },
  { script: "guard:buttons", title: "Button contract" },
  {
    script: "guard:geometry",
    title: "Geometry",
    // Radius, spacing and type: one vocabulary, the box decides the step, and
    // two ratchets that fail on the next new literal rather than on the ones
    // already counted. See docs/design-system/geometry-audit-2026-09-07.md.
  },
  { script: "generator:validate", title: "Generated screens" },
  { script: "guard:semantic", title: "Semantic architecture" },
  {
    script: "docs:index:check",
    title: "Docs index is current",
    // docs/README.md is generated from the files' own headings; a note added
    // without regenerating it is the drift this catches.
  },
  { script: "guard:admin:governance", title: "Admin governance" },
  { script: "guard:admin:i18n-tone", title: "Admin i18n and tone" },
  { script: "guard:admin:a11y-contract", title: "Admin a11y contract" },
  {
    script: "guard:admin:authz-coverage",
    title: "Admin authz coverage",
    // Fails when an admin route has no entry in data/admin-authz-matrix.json.
  },
];

const selected = only.length ? gates.filter((gate) => only.some((name) => gate.script.includes(name))) : gates;

if (selected.length === 0) {
  console.error(`No gate matches ${only.join(", ")}. Known: ${gates.map((gate) => gate.script).join(", ")}`);
  process.exit(1);
}

const failures = [];
const started = Date.now();

for (const gate of selected) {
  process.stdout.write(`\n──── ${gate.title}  (npm run ${gate.script})\n`);
  const result = spawnSync("npm", ["run", "-s", gate.script], { stdio: "inherit" });
  if (result.status !== 0) failures.push(gate);
}

const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(`\n${"─".repeat(60)}`);

if (failures.length > 0) {
  console.error(`verify:guards FAILED — ${failures.length} of ${selected.length} gates, ${seconds}s\n`);
  for (const gate of failures) console.error(`  ✗ ${gate.title}  →  npm run ${gate.script}`);
  console.error("");
  process.exit(1);
}

console.log(`verify:guards OK — ${selected.length} gates, ${seconds}s. Nothing here needed a server.`);
