#!/usr/bin/env node
/**
 * Builds the Claude Design bundle for the CenterWay icon set and the
 * dot/path/orbit hand-graphics language.
 *
 * Each page is self-contained (sprite inlined, no external requests) and opens
 * with a `@dsCard` marker so the Design System pane indexes it. Output is a
 * build artifact — regenerate rather than hand-edit.
 *
 *   node scripts/icons-preview.mjs            # -> .design/
 *   node scripts/icons-preview.mjs --out DIR
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { bakeSprites } from "./lib/icon-bake-core.mjs";
import {
  ICONS,
  GRAPHICS,
  HAND_PRESETS,
  DEFAULT_PRESET,
  groupsOf,
} from "./lib/icon-glyphs.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const PRESETS = ["base", "hand1", "hand2", "hand3"];

/**
 * Cards live in the project's `guidelines/` folder and pick up its tokens via
 * `../styles.css`. The literal fallbacks (mirrored from src/app/globals.css)
 * keep the same file readable straight off disk, where that stylesheet is
 * absent.
 */
const TOKENS = {
  light: {
    bg: "var(--cw-platform-bg, #f6f2ea)",
    surface: "var(--cw-platform-surface, #fbfaf6)",
    ink: "var(--cw-platform-text, #0d1b17)",
    muted: "var(--cw-platform-muted, #31403e)",
    line: "var(--cw-platform-border, rgba(13, 27, 23, 0.1))",
    icon: "var(--cw-sem-guide-strong, #1e3d34)",
    accent: "var(--cw-sem-warmth, #dba54f)",
  },
  dark: {
    bg: "#0f1c18",
    surface: "#16261f",
    ink: "#eef2ec",
    muted: "rgba(238, 242, 236, 0.68)",
    line: "rgba(238, 242, 236, 0.16)",
    icon: "#cfe0d6",
    accent: "#dba54f",
  },
};

const BASE_CSS = `
:root{color-scheme:light dark}
*{box-sizing:border-box}
body{margin:0;font:400 14px/1.6 Manrope,ui-sans-serif,system-ui,sans-serif;
  background:${TOKENS.light.bg};color:${TOKENS.light.ink};padding:32px 28px 48px}
h1{font:600 22px/1.3 Manrope,system-ui,sans-serif;margin:0 0 6px;letter-spacing:-.01em}
h2{font:600 13px/1.4 Manrope,system-ui,sans-serif;margin:32px 0 12px;
  letter-spacing:.08em;text-transform:uppercase;color:${TOKENS.light.muted}}
p.lede{margin:0 0 4px;max-width:74ch;color:${TOKENS.light.muted}}
code{font:400 12px "IBM Plex Mono",ui-monospace,monospace;
  background:rgba(13,27,23,.06);padding:1px 5px;border-radius:4px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:4px}
.cell{display:flex;flex-direction:column;align-items:center;gap:8px;
  padding:14px 6px 12px;border-radius:12px;background:${TOKENS.light.surface};
  border:1px solid ${TOKENS.light.line}}
.cell small{font:400 10px/1.2 "IBM Plex Mono",ui-monospace,monospace;
  color:${TOKENS.light.muted};text-align:center;word-break:break-word}
svg.ico{display:block;color:${TOKENS.light.icon};--cw-icon-accent:${TOKENS.light.accent}}
.panel{padding:20px;border-radius:16px;background:${TOKENS.light.surface};
  border:1px solid ${TOKENS.light.line}}
.panel.dark{background:${TOKENS.dark.surface};border-color:${TOKENS.dark.line}}
.panel.dark svg.ico{color:${TOKENS.dark.icon}}
.panel.dark .cell{background:rgba(255,255,255,.04);border-color:${TOKENS.dark.line}}
.panel.dark .cell small{color:${TOKENS.dark.muted}}
.rows{display:flex;flex-direction:column;gap:6px}
.row{display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start}
.rowlabel{font:500 12px/1.4 "IBM Plex Mono",ui-monospace,monospace;
  color:${TOKENS.light.muted};margin:18px 0 8px}
.rowlabel b{color:${TOKENS.light.ink};font-weight:600}
table{border-collapse:collapse;width:100%;max-width:76ch;margin:8px 0 0}
th,td{text-align:left;padding:7px 12px 7px 0;border-bottom:1px solid ${TOKENS.light.line};
  vertical-align:top;font-size:13px}
th{font:600 11px/1.4 Manrope,system-ui,sans-serif;letter-spacing:.06em;
  text-transform:uppercase;color:${TOKENS.light.muted}}
ul{margin:6px 0 0;padding-left:18px;max-width:74ch}
li{margin:4px 0}
.swatchrow{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}
.swatch{display:flex;align-items:center;gap:8px;padding:7px 12px 7px 8px;border-radius:999px;
  background:${TOKENS.light.surface};border:1px solid ${TOKENS.light.line};font-size:12px}
.chip{width:15px;height:15px;border-radius:50%;border:1px solid ${TOKENS.light.line}}
@media (prefers-color-scheme:dark){
  body{background:${TOKENS.dark.bg};color:${TOKENS.dark.ink}}
  h2,p.lede,.cell small,.rowlabel,th,td{color:${TOKENS.dark.muted}}
  .rowlabel b{color:${TOKENS.dark.ink}}
  code{background:rgba(255,255,255,.08)}
  .cell,.panel,.swatch{background:${TOKENS.dark.surface};border-color:${TOKENS.dark.line}}
  th,td{border-color:${TOKENS.dark.line}}
  svg.ico{color:${TOKENS.dark.icon}}
  .panel.dark{background:#0b1512}
}
`.trim();

function page({ card, title, sprite, body }) {
  return `<!-- @dsCard group="${card.group}" viewport="${card.viewport}" name="${card.name}" subtitle="${card.subtitle}" -->
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<link rel="stylesheet" href="../styles.css" />
<style>${BASE_CSS}</style>
</head>
<body>
${sprite.replace('<?xml version="1.0" encoding="UTF-8"?>\n', "")}
${body}
</body>
</html>
`;
}

const use = (name, size, cls = "ico") =>
  `<svg class="${cls}" width="${size}" height="${size}" aria-hidden="true"><use href="#cw-${name}"/></svg>`;

const cell = (name, size = 40) => `<div class="cell">${use(name, size)}<small>${name}</small></div>`;

// ── page: the whole set, grouped, light and dark ─────────────────────────────
function overviewPage(sprite) {
  const groups = [...groupsOf(ICONS)]
    .map(
      ([group, names]) =>
        `<h2>${group} <span style="text-transform:none;letter-spacing:0;font-weight:400">· ${names.length}</span></h2>
<div class="grid">${names.map((n) => cell(n)).join("")}</div>`,
    )
    .join("\n");

  const darkStrip = ["leaf", "bowl", "water", "breath", "vata", "pitta", "kapha", "check", "arrow-right", "week"]
    .map((n) => cell(n))
    .join("");

  return page({
    card: {
      group: "Icons",
      viewport: "1080x1500",
      name: "Icon set v1",
      subtitle: "38 glyphs · 24 grid · stroke 1.5 · baked hand2",
    },
    title: "CenterWay icons — set v1",
    sprite,
    body: `<h1>Icon set v1</h1>
<p class="lede">${Object.keys(ICONS).length} glyphs on a 24 grid, stroke 1.5, round caps and joins.
Character baked from clean geometry with preset <code>${DEFAULT_PRESET}</code> — no runtime filter.
Colour is <code>currentColor</code>; accent dots read <code>--cw-icon-accent</code>.</p>
${groups}
<h2>Dark surface</h2>
<div class="panel dark"><div class="grid">${darkStrip}</div></div>`,
  });
}

// ── page: the character ladder — the original sketch, now baked ──────────────
function characterPage(baked) {
  const sample = [
    "leaf",
    "bowl",
    "water",
    "stone",
    "breath",
    "day",
    "check",
    "arrow-right",
    "vata",
    "pitta",
    "kapha",
  ];

  // Each preset needs its own symbol ids, so prefix them per row.
  const rows = PRESETS.map((presetName) => {
    const preset = HAND_PRESETS[presetName];
    const note =
      presetName === "base"
        ? "clean geometry — reads like every other library"
        : presetName === "hand1"
          ? "barely there; warmth without a signature"
          : presetName === "hand2"
            ? "<b>approved</b> — the contour is alive, legibility intact"
            : "starts to fall apart on water / kapha";
    const spec = preset.scale
      ? `baseFrequency ${preset.frequency} · scale ${preset.scale}`
      : "no displacement";
    const glyphs = sample
      .map(
        (n) =>
          `<div class="cell"><svg class="ico" width="44" height="44" aria-hidden="true"><use href="#${presetName}-cw-${n}"/></svg><small>${n}</small></div>`,
      )
      .join("");
    return `<div class="rowlabel"><b>${presetName}</b> · ${spec} — ${note}</div>
<div class="row">${glyphs}</div>`;
  }).join("\n");

  // Merge all preset sprites into one, id-prefixed.
  const merged = PRESETS.map((presetName) =>
    baked
      .get(presetName)
      .sprite.replace(/<symbol id="cw-/g, `<symbol id="${presetName}-cw-`)
      .replace(/^[\s\S]*?<svg xmlns[^>]*>\n/, "")
      .replace(/<\/svg>\s*$/, ""),
  ).join("\n");

  return page({
    card: {
      group: "Icons",
      viewport: "1080x780",
      name: "Hand character ladder",
      subtitle: "base / hand1 / hand2 / hand3 — why hand2 is the one",
    },
    title: "CenterWay icons — hand character",
    sprite: `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n${merged}\n</svg>`,
    body: `<h1>Hand character ladder</h1>
<p class="lede">One geometric base, four amplitudes of the same seeded displacement field.
Every glyph in a row carries the identical hand — that is the point, and the reason this is
generated rather than drawn by hand 38 times.</p>
${rows}`,
  });
}

// ── page: dot / path / orbit ─────────────────────────────────────────────────
function graphicsPage(sprite) {
  const primitives = Object.keys(GRAPHICS)
    .map((n) => `<div class="cell">${use(n, 76)}<small>${n}</small></div>`)
    .join("");

  const stepOrbit = (steps, active) => {
    const r = 46;
    const cx = 60;
    const cy = 62;
    const dots = Array.from({ length: steps }, (_, i) => {
      const t = Math.PI * (0.15 + (0.7 * i) / (steps - 1));
      const x = cx - Math.cos(t) * r;
      const y = cy - Math.sin(t) * r;
      // Filled throughout — the dotted arc runs under the nodes, and an open
      // ring would let it show through as a hook.
      const fill = i < active ? "var(--cw-icon-accent)" : i === active ? "var(--cw-icon-accent)" : "currentColor";
      const opacity = i > active ? ".32" : "1";
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i === active ? 4 : 2.4}"
        fill="${fill}" opacity="${opacity}"/>`;
    }).join("");
    return `<div class="cell"><svg class="ico" width="120" height="76" viewBox="0 0 120 76" aria-hidden="true">
      <path d="M14 62A46 46 0 0 1 106 62" fill="none" stroke="currentColor" stroke-width="1.5"
        stroke-dasharray="2 5" opacity=".45"/>${dots}</svg><small>step-orbit ${steps} · active ${active + 1}</small></div>`;
  };

  return page({
    card: {
      group: "Brand",
      viewport: "1080x960",
      name: "Hand graphics",
      subtitle: "dot / path / orbit + rail, connector, step-orbit",
    },
    title: "CenterWay hand graphics",
    sprite,
    body: `<h1>Hand graphics — dot / path / orbit</h1>
<p class="lede">Three primitives, already present in the still-life photography and the emblem:
<b>dot</b> = where I am, <b>path</b> = what comes next, <b>orbit</b> = the cycle or phase.
Baked through the same displacement pass as the icons, so graphics and icons are one hand.</p>

<h2>Primitives and patterns</h2>
<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(124px,1fr))">${primitives}</div>

<h2>step-orbit — parametric</h2>
<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
${stepOrbit(3, 0)}${stepOrbit(5, 2)}${stepOrbit(7, 4)}</div>

<h2>Rules</h2>
<ul>
<li>Monoline 1–1.5, round caps. No fills except accent dots.</li>
<li>Opacity ≤ .5. Colour only from <code>--cw-sem-*</code>.</li>
<li><b>Never inside a text column</b> — this layer is navigation between blocks, not decoration behind copy.</li>
<li><code>stroke-dashoffset</code> reveal is disabled under <code>prefers-reduced-motion</code>.</li>
</ul>

<h2>Dark surface</h2>
<div class="panel dark"><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(124px,1fr))">${primitives}</div></div>`,
  });
}

// ── page: the contract ───────────────────────────────────────────────────────
function specPage(sprite) {
  // `value` may be a var() expression, so the printed hex is passed separately.
  const swatch = (label, value, hex) =>
    `<div class="swatch"><span class="chip" style="background:${value}"></span>${label} <code>${hex}</code></div>`;

  return page({
    card: {
      group: "Icons",
      viewport: "1080x1000",
      name: "Icon contract",
      subtitle: "metric, colour, pipeline, and the four do-nots",
    },
    title: "CenterWay icons — contract",
    sprite,
    body: `<h1>Icon contract</h1>
<p class="lede">What has to hold for a new glyph to belong to this set.</p>

<h2>Metric</h2>
<table>
<tr><th>Property</th><th>Value</th><th>Why</th></tr>
<tr><td>Grid</td><td>24 × 24</td><td>Phosphor Light metric — closest open set to our monoline</td></tr>
<tr><td>Stroke</td><td>1.5, round cap and join</td><td>Same weight as the hand-graphics layer</td></tr>
<tr><td>Fill</td><td>none, except accent dots</td><td>A dot is a node, not a shape</td></tr>
<tr><td>Character</td><td>preset <code>hand2</code> · baseFrequency .05 · scale 2.4</td><td>Approved in the 2026-08-15 study</td></tr>
<tr><td>Colour</td><td><code>currentColor</code> + <code>--cw-icon-accent</code></td><td>Inherits the tone scope it sits in; works in dark unchanged</td></tr>
</table>

<h2>Colour</h2>
<div class="swatchrow">
${swatch("icon ink · --cw-sem-guide-strong", TOKENS.light.icon, "#1e3d34")}
${swatch("icon ink · dark", TOKENS.dark.icon, "#cfe0d6")}
${swatch("accent · --cw-sem-warmth", TOKENS.light.accent, "#dba54f")}
</div>

<h2>Pipeline</h2>
<ul>
<li>Geometry is authored clean in <code>scripts/lib/icon-glyphs.mjs</code> — never with the wobble baked in.</li>
<li><code>npm run icons:build</code> resamples every path and displaces it once, at build time.</li>
<li><code>npm run icons:check</code> fails if a sprite on disk drifts from the geometry — the gate.</li>
<li>No <code>feDisplacementMap</code> ships. A runtime filter costs Safari a pass per icon and softens small glyphs.</li>
</ul>

<h2>Do not</h2>
<ul>
<li>Mix a second icon library into a screen — one weight, one radius, or the hand reads as noise.</li>
<li>Re-scale a glyph below 20px: at hand2 amplitude the wobble starts eating the counters.</li>
<li>Hard-code the accent. Dots take <code>--cw-icon-accent</code> so a tone scope can retune them.</li>
<li>Add a glyph without a role in the flow — the set answers “where am I / what step / what next”.</li>
</ul>

<h2>Sizes in the wild</h2>
<div class="row">
${[20, 24, 32, 40, 56].map((s) => `<div class="cell">${use("leaf", s)}<small>${s}px</small></div>`).join("")}
</div>`,
  });
}

async function main() {
  let out = path.join(ROOT, ".design");
  for (let i = 2; i < process.argv.length; i += 1) {
    if (process.argv[i] === "--out") out = path.resolve(process.argv[++i]);
    else throw new Error(`unknown argument: ${process.argv[i]}`);
  }

  const baked = await bakeSprites(PRESETS);
  const sprite = baked.get(DEFAULT_PRESET).sprite;

  // Paths follow the project's existing card convention (guidelines/*.card.html).
  const files = {
    "guidelines/icons-set.card.html": overviewPage(sprite),
    "guidelines/icons-character.card.html": characterPage(baked),
    "guidelines/icons-contract.card.html": specPage(sprite),
    "guidelines/graphics-primitives.card.html": graphicsPage(sprite),
  };

  for (const [rel, content] of Object.entries(files)) {
    const target = path.join(out, rel);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
    console.log(`wrote ${path.relative(ROOT, target)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
