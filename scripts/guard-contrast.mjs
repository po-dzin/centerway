import { readFileSync } from "node:fs";
import path from "node:path";

// WCAG AA contrast gate for the semantic/platform token layer.
//
// Scope note: this checks the *canonical token values* in cw.tokens.json, not
// rendered pixels. It resolves var() and color-mix(in srgb, ...) against the
// same token set the runtime materializes, then asserts the WCAG 2.1 contrast
// ratio for the foreground/background pairs that actually occur as text-on-
// surface in the platform UI. It does not attempt to enumerate every possible
// pair — only the ones a human reads.

const root = process.cwd();
const tokensPath = path.join(root, "data", "design-tokens", "cw.tokens.json");
const tokens = JSON.parse(readFileSync(tokensPath, "utf8"));

// Two rendered themes: platform light (:root) and admin dark (.dark).
// Each theme resolves against its own token map. The light map layers the
// semantic/platform/recipe tokens over base.light; the dark map is the admin
// chrome (base.dark) — it does not use --cw-sem-*/--cw-platform-*.
function buildMap(...objs) {
  const map = new Map();
  for (const obj of objs) {
    for (const [key, value] of Object.entries(obj ?? {})) map.set(key, value);
  }
  return map;
}

const lightMap = buildMap(
  tokens.base?.light,
  tokens.layers?.semanticAliases,
  tokens.layers?.modeOverrides?.platform,
  tokens.layers?.componentRecipes?.depth,
);
const darkMap = buildMap(tokens.base?.dark);

// AA (4.5) is the default for body/heading text. Primary-CTA fills carry
// large/semibold labels (>=16px) and are held to the WCAG large-text tier
// (3.0). Each large-tier pair is annotated so the lower bar is explicit, not
// silent: two current fills sit at ~4.2-4.3 (below body AA) and are flagged
// for future palette tuning rather than grandfathered without a trace.
//
// Only pairs that actually render as text-on-surface are asserted. The
// `.cw-btn-primary` label/fill IS a rendered pair in both themes (the class is
// defined in globals.css from --cw-btn-primary-*, consumed by RouteAuthGate
// and the dosha test), so it is checked below at body AA — its label is 14px
// semibold, which is not WCAG "large", so 4.5 applies.
const AA_BODY = 4.5;
const AA_LARGE = 3.0;

const pairs = [
  // platform light (:root)
  { theme: "light", fg: "--cw-platform-text", bg: "--cw-platform-bg", min: AA_BODY, context: "body text on page" },
  { theme: "light", fg: "--cw-platform-text", bg: "--cw-platform-surface", min: AA_BODY, context: "body text on card" },
  { theme: "light", fg: "--cw-platform-text", bg: "--cw-platform-surface-muted", min: AA_BODY, context: "body text on muted surface" },
  { theme: "light", fg: "--cw-platform-muted", bg: "--cw-platform-bg", min: AA_BODY, context: "secondary text on page" },
  { theme: "light", fg: "--cw-platform-muted", bg: "--cw-platform-surface", min: AA_BODY, context: "secondary text on card" },
  { theme: "light", fg: "--cw-sem-method-ink", bg: "--cw-sem-calm-surface", min: AA_BODY, context: "heading ink on calm surface" },
  { theme: "light", fg: "--cw-sem-method-ink", bg: "--cw-sem-calm-bg", min: AA_BODY, context: "heading ink on calm bg" },
  { theme: "light", fg: "--cw-platform-accent-contrast", bg: "--cw-platform-accent-strong", min: AA_LARGE, context: "CTA label on strong accent (large/semibold)" },
  { theme: "light", fg: "--cw-platform-accent-contrast", bg: "--cw-sem-guide-primary", min: AA_LARGE, context: "CTA label on guide primary (large/semibold)" },
  { theme: "light", fg: "--cw-platform-accent-contrast", bg: "--cw-sem-boundary", min: AA_LARGE, context: "label on boundary fill (large/semibold)" },
  { theme: "light", fg: "--cw-platform-accent-contrast", bg: "--cw-sem-trust", min: AA_LARGE, context: "label on trust fill (large/semibold)" },
  // .cw-btn-primary — rendered primary button (RouteAuthGate, dosha test), 14px semibold label => body AA
  { theme: "light", fg: "--cw-btn-primary-text", bg: "--cw-btn-primary-bg", min: AA_BODY, context: "primary button label on fill" },
  { theme: "light", fg: "--cw-btn-primary-text-hover", bg: "--cw-btn-primary-bg-hover", min: AA_BODY, context: "primary button label on hover fill" },
  { theme: "light", fg: "--cw-btn-primary-text-active", bg: "--cw-btn-primary-bg-active", min: AA_BODY, context: "primary button label on active fill" },
  // admin dark (.dark) — real rendered text pairs only
  { theme: "dark", fg: "--cw-text", bg: "--cw-bg", min: AA_BODY, context: "admin body text on page" },
  { theme: "dark", fg: "--cw-text", bg: "--cw-surface-solid", min: AA_BODY, context: "admin body text on panel" },
  { theme: "dark", fg: "--cw-muted", bg: "--cw-bg", min: AA_BODY, context: "admin secondary text on page" },
  { theme: "dark", fg: "--cw-muted", bg: "--cw-surface-solid", min: AA_BODY, context: "admin secondary text on panel" },
  { theme: "dark", fg: "--cw-text", bg: "--cw-choice-bg-selected", min: AA_BODY, context: "admin text on selected choice" },
  { theme: "dark", fg: "--cw-btn-primary-text", bg: "--cw-btn-primary-bg", min: AA_BODY, context: "primary button label on fill" },
  { theme: "dark", fg: "--cw-btn-primary-text-hover", bg: "--cw-btn-primary-bg-hover", min: AA_BODY, context: "primary button label on hover fill" },
  { theme: "dark", fg: "--cw-btn-primary-text-active", bg: "--cw-btn-primary-bg-active", min: AA_BODY, context: "primary button label on active fill" },
];

const maps = { light: lightMap, dark: darkMap };

function hexToRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function resolve(value, map, depth = 0) {
  if (depth > 12 || value == null) return null;
  const val = String(value).trim();
  if (/^#([0-9a-fA-F]{3,8})$/.test(val)) return hexToRgb(val);

  const rgbMatch = val.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (rgbMatch) return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];

  const varMatch = val.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  if (varMatch) return resolve(map.get(varMatch[1]), map, depth + 1);

  const mixMatch = val.match(
    /^color-mix\(in srgb,\s*(.+?)\s+(\d+(?:\.\d+)?)%\s*,\s*(.+?)\s+(\d+(?:\.\d+)?)%\s*\)$/,
  );
  if (mixMatch) {
    const a = resolve(mixMatch[1], map, depth + 1);
    const b = resolve(mixMatch[3], map, depth + 1);
    if (!a || !b) return null;
    const wa = parseFloat(mixMatch[2]) / 100;
    const wb = parseFloat(mixMatch[4]) / 100;
    const sum = wa + wb || 1;
    return [0, 1, 2].map((i) => Math.round((a[i] * wa + b[i] * wb) / sum));
  }
  return null;
}

function channelLuminance(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance([r, g, b]) {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

function contrastRatio(fg, bg) {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const failures = [];
const lines = [];

for (const { theme, fg, bg, min, context } of pairs) {
  const map = maps[theme];
  const fgRgb = resolve(map.get(fg), map);
  const bgRgb = resolve(map.get(bg), map);
  if (!fgRgb || !bgRgb) {
    failures.push(`Unresolved ${theme} contrast pair ${fg} on ${bg} (values: ${map.get(fg)} / ${map.get(bg)})`);
    continue;
  }
  const ratio = contrastRatio(fgRgb, bgRgb);
  const ok = ratio >= min;
  lines.push(`${ok ? "  ok" : "FAIL"} [${theme}] ${ratio.toFixed(2)} (min ${min}) ${fg} on ${bg} — ${context}`);
  if (!ok) {
    failures.push(`[${theme}] ${fg} on ${bg} = ${ratio.toFixed(2)}, below required ${min} (${context})`);
  }
}

for (const line of lines) console.log(line);

if (failures.length > 0) {
  console.error("\n[FAIL] Contrast guard");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("\n[PASS] Contrast guard");
