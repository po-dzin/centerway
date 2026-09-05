import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const TOKENS_PATH = path.join(repoRoot, "data", "design-tokens", "cw.tokens.json");
const GLOBALS_CSS_PATH = path.join(repoRoot, "src", "app", "globals.css");
// The five landing-network hosts are static pages that never load globals.css,
// so they used to carry hand-copied duplicates of the platform palette. This
// file is the same values emitted from the same source, which is what keeps the
// network from drifting away from the platform on the next palette edit.
const NETWORK_CSS_PATH = path.join(
  repoRoot, "src", "landing-static", "shared", "css", "cw-tokens.generated.css",
);

const LIGHT_START = "/* DS_ALIAS_LIGHT_START */";
const LIGHT_END = "/* DS_ALIAS_LIGHT_END */";
const BASE_LIGHT_START = "/* CW_BASE_LIGHT_START */";
const BASE_LIGHT_END = "/* CW_BASE_LIGHT_END */";
const RUNTIME_START = "/* CW_RUNTIME_TOKENS_START */";
const RUNTIME_END = "/* CW_RUNTIME_TOKENS_END */";
const MATERIAL_DARK_START = "/* CW_MATERIAL_DARK_START */";
const MATERIAL_DARK_END = "/* CW_MATERIAL_DARK_END */";
const PLATFORM_DARK_START = "/* CW_PLATFORM_DARK_START */";
const PLATFORM_DARK_END = "/* CW_PLATFORM_DARK_END */";
const PACK_MINERAL_START = "/* CW_PACK_MINERAL_START */";
const PACK_MINERAL_END = "/* CW_PACK_MINERAL_END */";
const COURSE_PACKS_START = "/* CW_COURSE_PACKS_START */";
const COURSE_PACKS_END = "/* CW_COURSE_PACKS_END */";

function toDecls(map, indent = "  ") {
  return Object.entries(map)
    .map(([name, value]) => `${indent}${name}: ${value};`)
    .join("\n");
}

function replaceBetween(source, startMarker, endMarker, nextBody) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Missing markers: ${startMarker} ... ${endMarker}`);
  }

  const before = source.slice(0, start);
  const after = source.slice(end + endMarker.length);
  return `${before}${startMarker}\n${nextBody}\n    ${endMarker}${after}`;
}

function upsertBefore(source, startMarker, endMarker, beforeNeedle, nextBody) {
  if (source.includes(startMarker) && source.includes(endMarker)) {
    return replaceBetween(source, startMarker, endMarker, nextBody);
  }
  const index = source.indexOf(beforeNeedle);
  if (index === -1) {
    throw new Error(`Missing insertion point: ${beforeNeedle}`);
  }
  const block = `${startMarker}\n${nextBody}\n    ${endMarker}\n\n    `;
  return `${source.slice(0, index)}${block}${source.slice(index)}`;
}

function flattenRuntimeLayers(layers) {
  if (!layers) return {};
  return {
    ...(layers.semanticAliases ?? {}),
    ...(layers.modeOverrides?.platform ?? {}),
    ...(layers.material?.light ?? {}),
  };
  // routeOverlays is deliberately NOT flattened in. It is the generator's own
  // layer (data/generator/branch_overlays.json reads it); its one member,
  // --cw-branch-grid-discipline, was declared on :root of every page and read
  // by no component or stylesheet in src/. A token that ships to the browser
  // and is never resolved there is payload, not a system. See
  // docs/design-system.md → "Three findings from the first drift probe".
}

// Colour-only subset: the landings need the palette and the material, not the
// brand asset URLs (those live behind /cw/** which the funnel hosts do not serve)
// nor the symbol gradients that only the generator surfaces use.
function isNetworkToken(name) {
  if (name.startsWith("--cw-mat-")) return true;
  if (!name.startsWith("--cw-sem-")) return false;
  return !name.startsWith("--cw-sem-symbol-");
}

function pickNetworkTokens(map) {
  return Object.fromEntries(Object.entries(map ?? {}).filter(([name]) => isNetworkToken(name)));
}

/* The button contract's geometry, emitted so the landings can *reference* it
   instead of re-deciding a height and a corner of their own — which is exactly
   how the network ended up padding-driven with no min-height while the platform
   ran a 3rem target. Colour is deliberately excluded: the network paints from
   its own --cw-net-* skin. Listed explicitly rather than by prefix, so widening
   the radius scale or the --ds-* alias does not silently enlarge the network
   payload. The chain has to close inside this file, hence --cw-radius-btn/md
   travel with the --ds-button-* that point at them. */
const NETWORK_BUTTON_TOKENS = [
  "--cw-radius-md",
  "--cw-radius-btn",
  "--ds-touch-target-min",
  "--ds-button-min-height",
  "--ds-button-padding-inline",
  "--ds-button-radius",
  "--ds-button-font-weight",
  "--ds-button-font-size",
  "--ds-button-gap",
  "--ds-button-lift",
  /* The rail control (carousel arrow) is button geometry too — one plate, one
     glyph box, one overhang, shared by the platform's offer rail and the
     landings' proof rails. It travelled as three hand-tuned recipes (44px /
     46px / 48px, two of them dimming at the edge instead of leaving) until
     these three names existed. See docs/design-system.md → "The rail control". */
  "--ds-rail-control-size",
  "--ds-rail-control-icon",
  "--ds-rail-control-overhang",
];

/* The spatial contract: where a page's content column starts, and how the
   topbar sits against it. Emitted for the same reason as the button geometry —
   the landings cannot compose a CSS Module, so the only way they can reference
   the column instead of re-deciding it is as tokens.

   The network ran two gutters before this: the landings' hand-tuned fluid
   clamp and the platform's flat 1rem, which was a first-commit default no
   document ever argued for. On an iPad they differed by 24px. One value now.

   --cw-bar-inset is derived from the other two rather than stated, because the
   bar's inset is not an independent choice: the mark and the burger are
   content, so the bar floats exactly one bar-pad wider than the column and its
   contents land on the column's line. Listed explicitly, same as the button
   set, so widening a scale does not silently enlarge the network payload. */
const NETWORK_SPACE_TOKENS = ["--cw-max-width", "--cw-page-gutter", "--cw-bar-pad", "--cw-bar-inset"];

function pickListedTokens(names, label, ...maps) {
  const merged = Object.assign({}, ...maps.map((m) => m ?? {}));
  const out = {};
  for (const name of names) {
    if (merged[name] !== undefined) out[name] = merged[name];
  }
  const missing = names.filter((name) => out[name] === undefined);
  if (missing.length > 0) {
    throw new Error(`${label} tokens missing from cw.tokens.json: ${missing.join(", ")}`);
  }
  return out;
}

function pickButtonTokens(...maps) {
  return pickListedTokens(NETWORK_BUTTON_TOKENS, "Button contract", ...maps);
}

function pickSpaceTokens(...maps) {
  return pickListedTokens(NETWORK_SPACE_TOKENS, "Spatial contract", ...maps);
}

function buildNetworkCss(tokens) {
  const layers = tokens.layers ?? {};
  const light = {
    ...pickNetworkTokens({
      ...(layers.semanticAliases ?? {}),
      ...(layers.material?.light ?? {}),
    }),
    ...pickButtonTokens(tokens.base?.light, tokens.delivery?.dsAlias?.light),
    ...pickSpaceTokens(tokens.base?.light),
  };
  const dark = pickNetworkTokens(layers.material?.dark ?? {});

  return [
    "/* GENERATED by scripts/generate-design-tokens.mjs — do not edit.",
    "   Source: data/design-tokens/cw.tokens.json (layers.semanticAliases + layers.material",
    "   + the button contract's geometry from base/delivery).",
    "",
    "   The platform palette and material, emitted for the five static landing",
    "   hosts that cannot load globals.css. Loaded first on every landing, so",
    "   network-tokens.css can reference these instead of copying their values —",
    "   change a colour in the JSON and the whole network moves with the platform.",
    "   Drift is caught by `npm run tokens:check`. */",
    "",
    ":root {",
    toDecls(light, "  "),
    "}",
    "",
    '[data-cw-theme="dark"] {',
    toDecls(dark, "  "),
    "}",
    "",
  ].join("\n");
}

async function main() {
  const rawTokens = await readFile(TOKENS_PATH, "utf8");
  const tokens = JSON.parse(rawTokens);

  const globals = await readFile(GLOBALS_CSS_PATH, "utf8");
  const dsAlias = tokens.delivery?.dsAlias ?? {};
  const lightDecls = toDecls(dsAlias.light ?? {}, "    ");
  const runtimeDecls = toDecls(flattenRuntimeLayers(tokens.layers), "    ");
  const materialDarkDecls = toDecls(tokens.layers?.material?.dark ?? {}, "    ");
  const platformDarkDecls = toDecls(tokens.layers?.modeOverrides?.platformDark ?? {}, "    ");
  // Packs re-point the same role names, so a pack block is the semantic layer
  // again with different values — never a second set of token names.
  const packMineralDecls = toDecls(tokens.layers?.packs?.mineral ?? {}, "    ");
  // Every pack, as an attribute scope. A course carries its gamma as data
  // (`data-cw-pack="way21"`), because the value comes out of a row rather than
  // out of a class someone typed — see src/lms-core/theme.ts. Mineral keeps its
  // original `.cw-pack-mineral` class above; this adds the attribute form
  // without moving a single value.
  //
  // The platform aliases are re-emitted INSIDE each scope, and that is the part
  // that makes a pack visible at all. `--cw-platform-bg: var(--cw-sem-calm-bg)`
  // is declared on `:root`, and a custom property is substituted where it is
  // DECLARED — so a descendant that re-points `--cw-sem-calm-bg` inherits the
  // platform alias already resolved against the root's value and nothing
  // repaints. Declaring the aliases again in the scope re-resolves them against
  // the pack. They come first, so a pack that pins a platform value of its own
  // (mineral's ink) still wins.
  //
  // AND THAT RE-EMISSION IS EXACTLY WHAT KEPT THE DARK THEME OFF. Every pack
  // block was a COMPLETE LIGHT PALETTE, so a course preview nested inside the
  // dark scope put the light gamma's cream ground and near-black ink back on
  // top of the night — which is what was found by switching dark on, and why
  // the palette sat authored-but-unshipped until now. The fix is not to drop
  // the re-emission but to SCOPE it: a pack is a LIGHT-SIDE axis.
  //
  // Two rules per pack, and they can never both match:
  //   light — the aliases re-resolved against the pack, then the pack's own
  //           values, including any platform value it pins (mineral's ink).
  //   dark  — the pack's HUE roles only, listed below. The grounds, the inks
  //           and every platform token are left to inherit from the dark root,
  //           so a course changes its colour on the night ground instead of
  //           dragging a cream sheet into it.
  //
  // The dark side is an ALLOW list, not a deny list, and that is the point: a
  // pack that grows a new token tomorrow contributes it to the light theme and
  // NOTHING to the dark one until someone adds it here on purpose. A deny list
  // would have let the next `--cw-sem-calm-*` leak a light ground back in,
  // which is the exact failure this is written against.
  //
  // The dark side is attribute-only on purpose: the pre-paint script stamps
  // `data-cw-theme` before first paint (see src/lib/platform/theme.ts), so
  // there is no media query to keep in step with these selectors.
  const platformAliases = tokens.layers?.modeOverrides?.platform ?? {};
  const aliases = tokens.layers?.semanticAliases ?? {};
  const PACK_DARK_ROLES = new Set([
    "--cw-sem-guide-primary",
    "--cw-sem-embodied",
    "--cw-sem-progress",
    "--cw-sem-warmth",
    "--cw-sem-warmth-strong",
    "--cw-sem-boundary",
    "--cw-sem-trust",
  ]);
  const coursePackDecls = Object.entries(tokens.layers?.packs ?? {})
    .map(([name, values]) => {
      const hueOnly = Object.fromEntries(
        Object.entries(values).filter(([token]) => PACK_DARK_ROLES.has(token))
      );
      // The SWATCH the builder shows for this gamma, and it applies in both
      // themes on purpose. A swatch is not the surface — it is a picture OF the
      // surface, and a course's gamma is a light-side choice, so the sample has
      // to keep showing the light values even while the builder around it is
      // dark. Without this the scoping above made every swatch collapse to the
      // root's colours and the palette picker went blind, which is the failure
      // the mineral pack's own comment warns about ("a palette chosen from five
      // words is a palette chosen blind").
      const sample = {
        "--cw-pack-sample-ink": values["--cw-sem-guide-primary"] ?? aliases["--cw-sem-guide-primary"],
        "--cw-pack-sample-ground": values["--cw-sem-calm-bg"] ?? aliases["--cw-sem-calm-bg"],
      };
      return [
        `  [data-cw-pack="${name}"] {`,
        toDecls(sample, "    "),
        "  }",
        "",
        `  :root:not([data-cw-theme="dark"]) [data-cw-pack="${name}"] {`,
        toDecls(platformAliases, "    "),
        toDecls(values, "    "),
        "  }",
        "",
        `  [data-cw-theme="dark"] [data-cw-pack="${name}"] {`,
        toDecls(hueOnly, "    "),
        "  }",
      ].join("\n");
    })
    .join("\n\n");

  const baseLightDecls = toDecls(tokens.base?.light ?? {}, "    ");

  let nextGlobals = upsertBefore(globals, BASE_LIGHT_START, BASE_LIGHT_END, RUNTIME_START, baseLightDecls);
  nextGlobals = upsertBefore(nextGlobals, RUNTIME_START, RUNTIME_END, "/* Platform DS contract:", runtimeDecls);
  nextGlobals = upsertBefore(nextGlobals, LIGHT_START, LIGHT_END, "/* Platform DS contract:", lightDecls);
  nextGlobals = upsertBefore(nextGlobals, MATERIAL_DARK_START, MATERIAL_DARK_END, "/* Public platform dark palette", materialDarkDecls);
  nextGlobals = upsertBefore(nextGlobals, PLATFORM_DARK_START, PLATFORM_DARK_END, "/* Public platform dark palette", platformDarkDecls);
  nextGlobals = replaceBetween(nextGlobals, PACK_MINERAL_START, PACK_MINERAL_END, packMineralDecls);
  nextGlobals = replaceBetween(nextGlobals, COURSE_PACKS_START, COURSE_PACKS_END, coursePackDecls);

  await writeFile(GLOBALS_CSS_PATH, nextGlobals, "utf8");
  await writeFile(NETWORK_CSS_PATH, buildNetworkCss(tokens), "utf8");
}

await main();
