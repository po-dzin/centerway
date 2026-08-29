#!/usr/bin/env node
/**
 * Button guard — "one contract, five roles".
 *
 * The same button was written five times across this codebase (platform shell,
 * hero, cabinet, LMS, offer tiles) and the copies drifted on every axis that
 * was not a token: label weight came out 600/700/800, the gold gradient was
 * duplicated verbatim in three files and flattened in two others, inline
 * padding took four values. Radius was the only axis that held — because it was
 * a token from the start. That is the whole thesis: an axis with no token is an
 * axis that will diverge, and a doc alone does not stop it. This does.
 *
 * The rule: a component stylesheet may not declare button geometry, type or the
 * accent fill itself. It composes a role from PlatformButtons.module.css and
 * adds layout (width, justify-self, grid placement) or a locally themed colour.
 *
 * Scope is the platform's CSS Modules. The five static landings are out — they
 * never load globals.css and carry their own `--cw-net-*` skin; their button
 * geometry is checked against the network mirror instead (see --network).
 *
 * Usage:
 *   node scripts/guard-buttons.mjs            # fail on violations
 *   node scripts/guard-buttons.mjs --report   # list every button-ish rule
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const componentsDir = path.join(repoRoot, "src/components");
const contractFile = path.join(repoRoot, "src/components/platform/PlatformButtons.module.css");
const networkTokens = path.join(repoRoot, "src/landing-static/shared/css/network-tokens.css");

const report = process.argv.includes("--report");

/* A selector naming a button. Chips, badges and bars are not buttons and are
   not checked — `.completeToggle` is a checkbox and says so.

   `Option|Trigger|Switch|Tab` joined the list on 2026-08-23. They were the
   builder's blind spot: `.viewOption`, `.menuTrigger`, `.toolTab` and
   `.viewSwitch` are all pressable controls with hover, focus and selected
   states, and none of them matched the old suffixes — which is how the view
   switch came to carry two whole recipes, a segmented one and an ink one,
   arguing 2,700 lines apart with the later winning by position. A control the
   guard cannot name is a control that drifts. */
const BUTTON_SELECTOR =
  /^\.[A-Za-z][A-Za-z0-9_]*(?:Button|Btn|Link|Action|Cta|Toggle|Option|Trigger|Switch|Tab)(?=$|[A-Z0-9_])[A-Za-z0-9_]*$/;

/* The lookahead is what makes `Tab` safe to match on: it must end the name or
   be followed by another camelCase word, so `.toolTab` is a control and
   `.previewTable` is a table. It also draws a line this codebase already
   observes by habit — a SINGULAR name is the control, a PLURAL one is the row
   that holds controls. `.toolTabs`, `.pageHeadActions` and `.heroFeatureActions`
   are containers, and none of them is checked. */

/* Caught by the suffix match but not controls. Each is here with its reason —
   an exemption is a statement, not a silencer, and this list is one grep away
   from review. */
const NOT_BUTTONS = new Map([
  ["outlineLink", "a lesson row in the course outline — a list item, sized by its content"],
  [
    "contentsLink",
    "a lesson row in the builder's contents drawer — the same shape as " +
      "outlineLink: a list item sized by its content, not a control.",
  ],
  ["pagerLink", "the prev/next lesson card — a full plate carrying a title, not a control"],
  ["videoActionMeta", "the caption under the video rail's buttons, not a button"],
  ["videoActionCard", "the plate the video rail's buttons sit in"],
  ["mobileMenuSurface", "the menu bar itself; its children are the controls"],
  ["mobileMenuActions", "a row that holds controls"],
  ["heroFeatureActions", "the hero's action row — a container, its children are the controls"],
  [
    "completeToggle",
    "a CHECKBOX, not a button — marking a lesson done is a state you own and can " +
      "undo. Deliberately shaped like the bar it composes; see docs \"One container per control\".",
  ],
  [
    "courseRailLink",
    "a row in the builder's course rail — the same shape as outlineLink: a list " +
      "item sized by its content, whose `padding: 0` is a reset of the anchor's " +
      "own, not a button geometry.",
  ],
  [
    "diagnosticOption",
    "a LAYOUT modifier on `.cw-choice-btn`, the globals-owned choice control the " +
      "dosha test renders beside it — the fill, border and radius come from there, " +
      "not from this rule. The real fix is putting .cw-choice-btn on the contract, " +
      "which is the admin/globals wave; exempted until then rather than papered " +
      "over by moving four literals into this file.",
  ],
  [
    "menuButton",
    "a utility control (the burger). Utility chrome carries no label and runs its " +
      "own square-ish --platform-utility-control-radius; see docs \"Utility controls carry no label\".",
  ],
]);

/* Declaring any of these is claiming the contract's job. The value column says
   which token the property must come from when a rule legitimately sets it
   (the contract file itself, and nothing else, may set them literally). */
const OWNED = {
  /* The two size floors accept either token. They are the same 3rem, and which
     one a rule names is a statement about WHY: a menu row is a touch target,
     a button is a button. Forcing --ds-button-min-height onto a list row would
     make the rule lie to read green. */
  "min-height": ["--ds-button-min-height", "--ds-touch-target-min"],
  "min-width": ["--ds-button-min-width", "--ds-touch-target-min"],
  "padding-inline": ["--ds-button-padding-inline"],
  "border-radius": ["--ds-button-radius"],
  "font-weight": ["--ds-button-font-weight"],
  "font-size": ["--ds-button-font-size"],
  "max-width": ["--ds-button-max-width"],
};

/* A shorthand sets the longhand the contract owns, and the longhand check
   cannot see it: `padding: .9rem 1rem` writes padding-inline, and `font:
   inherit` writes font-size and font-weight. The builder's status cells passed
   for months on exactly that technicality. A shorthand is only reported when
   it actually carries the axis — `padding-block` alone is not padding-inline,
   and `font: inherit` is the honest way to say "take the surrounding type",
   so it is allowed while `font: 700 1rem/1.1 Manrope` is not. */
const SHORTHANDS = [
  { prop: "padding", axis: "padding-inline", token: "--ds-button-padding-inline",
    carries: (v) => v.trim().split(/\s+/).length !== 1 || !/^var\(/.test(v.trim()) },
  { prop: "font", axis: "font-size / font-weight", token: "--ds-button-font-size",
    carries: (v) => v.trim() !== "inherit" },
];

/* The accent ramp has exactly one home. */
const ACCENT_FILL = /linear-gradient\([^)]*--cw-platform-accent/;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".module.css")) out.push(full);
  }
  return out;
}

/** Every `selector { body }` rule, inside media blocks as well as outside.
    Comments go first so a selector quoted in prose is not read as code, and the
    at-rule openers go with them — a `@media (...) {` line left in place would
    be picked up as a selector, and matching on `}` boundaries instead would
    silently skip every second rule. */
function rules(css) {
  const flat = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/@[a-z-]+[^{]*\{/gi, "");
  const found = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(flat))) {
    const selector = m[1].trim();
    if (!selector || selector.startsWith("@")) continue;
    found.push({ selector, body: m[2] });
  }
  return found;
}

const violations = [];
const seen = [];
let netChecked = 0;

for (const file of walk(componentsDir)) {
  if (file === contractFile) continue;
  const css = fs.readFileSync(file, "utf8");
  const rel = path.relative(repoRoot, file);

  for (const { selector, body } of rules(css)) {
    const isButton = selector
      .split(",")
      .map((s) => s.trim())
      .some((s) => BUTTON_SELECTOR.test(s));
    if (!isButton) continue;
    /* Only the parts that actually read as a button selector can carry the
       rule, so only those decide the exemption. A grouped rule that also names
       a descendant (`.heroFeature .heroFeatureActions, .heroFeatureActions`)
       used to defeat the map, because the descendant part is not a key. */
    const exempt = selector
      .split(",")
      .map((s) => s.trim())
      .filter((s) => BUTTON_SELECTOR.test(s))
      .every((s) => NOT_BUTTONS.has(s.replace(/^\./, "")));
    if (exempt) continue;

    const composes = /composes:\s*([^;]+);/.exec(body)?.[1] ?? "";
    seen.push({ rel, selector, composes: composes.trim() });

    for (const [prop, tokens] of Object.entries(OWNED)) {
      const decl = new RegExp(`(^|[;{\\s])${prop}\\s*:\\s*([^;]+)`, "m").exec(body);
      if (!decl) continue;
      if (tokens.some((t) => decl[2].includes(t))) continue;
      const token = tokens[0];
      violations.push(
        `${rel}\n    ${selector} { ${prop}: ${decl[2].trim()} }\n` +
          `    → the contract owns ${prop}. Compose a role from PlatformButtons.module.css,\n` +
          `      or if this really is a new case, use var(${token}).`,
      );
    }

    for (const { prop, axis, token, carries } of SHORTHANDS) {
      const decl = new RegExp(`(^|[;{\\s])${prop}\\s*:\\s*([^;]+)`, "m").exec(body);
      if (!decl) continue;
      const value = decl[2].trim();
      if (!carries(value)) continue;
      if (value.includes(token)) continue;
      violations.push(
        `${rel}\n    ${selector} { ${prop}: ${value} }\n` +
          `    → the shorthand sets ${axis}, which the contract owns. Compose a role from\n` +
          `      PlatformButtons.module.css, or set only the axes it does not own.`,
      );
    }

    if (ACCENT_FILL.test(body)) {
      violations.push(
        `${rel}\n    ${selector} — the gold ramp is defined once, in PlatformButtons.module.css.\n` +
          `    → compose \`primary\` instead of repeating the gradient.`,
      );
    }
  }
}

/* ── The network ──────────────────────────────────────────────────────────
   The five landings paint from their own --cw-net-* skin and cannot compose a
   CSS Module, so the contract reaches them as tokens rather than as a class.
   The rule there is narrower but the same in spirit: a button-named rule may
   not write a geometry literal. It must resolve the axis from the contract —
   `var(--ds-button-*)`, or the network's own `--btn-*`/`--r-btn` aliases, which
   are bound to it in network-tokens.css.

   Fallbacks are allowed and expected: `var(--ds-button-min-height, 3rem)`. Some
   of these sheets are self-contained by design (funnel-network.css is the
   generator runtime; pages.css serves the thin utility pages), so the literal
   after the comma is the only thing standing between a stale cache and a broken
   control. It must agree with the token — which is what CONTRACT_VALUES checks.

   Short/IREM are excluded: different authors, isolated themes (their landings
   are a separate product surface, not this design system's coverage). */
const NETWORK_SHEETS = [
  "src/landing-static/shared/css/landing.css",
  "src/landing-static/shared/css/network-tokens.css",
  "src/landing-static/shared/css/funnel-network.css",
  "src/landing-static/shared/css/pages.css",
  "src/landing-static/shared/css/landing.bridge.css",
  "src/landing-static/way21/page.css",
  "src/landing-static/reset-day/page.css",
];

/* What each axis must resolve to, so a fallback cannot quietly disagree with
   the token it stands in for. Read from the generated network file rather than
   hardcoded here — one source, and this list only says which names matter. */
const CONTRACT_VALUES = {
  "--ds-button-min-height": "3rem",
  "--ds-button-padding-inline": "1.15rem",
  "--ds-button-radius": "1rem",
  "--ds-button-font-size": "1rem",
  "--ds-button-font-weight": "700",
  "--ds-button-gap": "0.5rem",
  "--ds-button-lift": "-1px",
  "--ds-touch-target-min": "3rem",
};

const NET_BUTTON_SELECTOR = /(^|[\s.#>~+])(btn|cw-btn)([-_][a-z0-9-]+)?$/i;

for (const rel of NETWORK_SHEETS) {
  const abs = path.join(repoRoot, rel);
  if (!fs.existsSync(abs)) continue;
  const css = fs.readFileSync(abs, "utf8");

  for (const { selector, body } of rules(css)) {
    const isButton = selector
      .split(",")
      .map((x) => x.trim())
      .some((x) => NET_BUTTON_SELECTOR.test(x.replace(/:[a-z-]+(\([^)]*\))?/g, "").trim()));
    if (!isButton) continue;
    netChecked += 1;

    for (const [prop, token] of Object.entries(OWNED)) {
      const decl = new RegExp(`(^|[;{\\s])${prop}\\s*:\\s*([^;]+)`, "m").exec(body);
      if (!decl) continue;
      const value = decl[2].trim();
      if (/var\(--(ds-button|btn|r-btn|ds-touch)/.test(value)) continue;
      // `min-width: min(100%, 15rem)` is a layout call — "full width up to 15rem" —
      // not the contract's standalone width reservation. A bare length there is.
      if (prop === "min-width" && /^(min|max|clamp)\(|%/.test(value)) continue;
      violations.push(
        `${rel}\n    ${selector} { ${prop}: ${value} }\n` +
          `    → the network reads the contract through tokens. Use var(${token}) —\n` +
          `      or the --btn-* / --r-btn alias bound to it in network-tokens.css.`,
      );
    }
  }

  /* A fallback that disagrees with its token is worse than no fallback: it
     renders correctly in dev and wrong behind a stale cache. */
  for (const [token, expected] of Object.entries(CONTRACT_VALUES)) {
    const re = new RegExp(`var\\(\\s*${token}\\s*,\\s*([^),]+)\\)`, "g");
    let m;
    while ((m = re.exec(css))) {
      const norm = (v) => v.trim().replace(/(^|[\s(,])\.(\d)/g, "$10.$2");
      const got = m[1].trim();
      if (norm(got) === norm(expected)) continue;
      violations.push(
        `${rel}\n    var(${token}, ${got}) — the fallback disagrees with the token (${expected}).`,
      );
    }
  }
}

/* The network's own corner alias must still resolve from the contract rather
   than being a literal that happens to match today. */
const netBtn = /--r-btn:\s*([^;]+);/.exec(fs.readFileSync(networkTokens, "utf8"))?.[1]?.trim();
if (!netBtn?.includes("--ds-button-radius")) {
  violations.push(
    `src/landing-static/shared/css/network-tokens.css\n` +
      `    --r-btn: ${netBtn} — must resolve from var(--ds-button-radius), not restate the value.`,
  );
}

if (report) {
  for (const s of seen.sort((a, b) => a.rel.localeCompare(b.rel))) {
    console.log(`${s.rel}\n  ${s.selector}${s.composes ? `\n    composes: ${s.composes}` : "  (no composes)"}`);
  }
  console.log(`\n${seen.length} button rules across ${new Set(seen.map((s) => s.rel)).size} files`);
}

if (violations.length > 0) {
  console.error(`\n[FAIL] Button contract guard (${violations.length})\n`);
  for (const v of violations) console.error(`  - ${v}\n`);
  console.error("  Contract: src/components/platform/PlatformButtons.module.css");
  console.error("  Doc:      docs/design-system.md → Buttons\n");
  process.exit(1);
}

console.log(
  `\n[PASS] Button contract guard — ${seen.length} platform rules, ${netChecked} network rules`,
);
