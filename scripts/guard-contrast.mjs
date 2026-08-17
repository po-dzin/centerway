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
  tokens.layers?.material?.light,
);
// The dark map is admin chrome (base.dark) plus the material dark half. The
// semantic aliases ride along because material dark mixes --cw-sem-warmth into
// its surface; they define no base.dark names, so nothing is shadowed.
const darkMap = buildMap(
  tokens.base?.dark,
  tokens.layers?.semanticAliases,
  tokens.layers?.material?.dark,
);

// The public platform's own dark scope ([data-cw-theme="dark"]), which is a
// different cascade from admin's .dark — see the comment beside those two
// selectors in globals.css. It resolves like the light platform map with the
// dark palette and material laid over it.
const platformDarkMap = buildMap(
  tokens.base?.light,
  tokens.layers?.semanticAliases,
  tokens.layers?.modeOverrides?.platform,
  tokens.layers?.componentRecipes?.depth,
  tokens.layers?.material?.light,
  tokens.layers?.material?.dark,
  tokens.layers?.modeOverrides?.platformDark,
);

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
  // Gold CTA (.heroPrimaryButton, .videoActionButton[data-kind=primary]). The
  // fill is a gradient between these two stops, so both are asserted; the
  // lighter one binds. Label is 16px/800 — not WCAG "large", so body AA.
  { theme: "light", fg: "--cw-platform-on-accent", bg: "--cw-platform-accent", min: AA_BODY, context: "ink label on gold CTA (lighter gradient stop)" },
  { theme: "light", fg: "--cw-platform-on-accent", bg: "--cw-platform-accent-pressed", min: AA_BODY, context: "ink label on deep-gold CTA (darker stop / hover)" },
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
  // public platform dark ([data-cw-theme="dark"]) — mirrors every light pair, so
  // the two halves of the public palette are held to the same bar.
  { theme: "platform-dark", fg: "--cw-platform-text", bg: "--cw-platform-bg", min: AA_BODY, context: "body text on page" },
  { theme: "platform-dark", fg: "--cw-platform-text", bg: "--cw-platform-surface", min: AA_BODY, context: "body text on card" },
  { theme: "platform-dark", fg: "--cw-platform-text", bg: "--cw-platform-surface-muted", min: AA_BODY, context: "body text on muted surface" },
  { theme: "platform-dark", fg: "--cw-platform-muted", bg: "--cw-platform-bg", min: AA_BODY, context: "secondary text on page" },
  { theme: "platform-dark", fg: "--cw-platform-muted", bg: "--cw-platform-surface", min: AA_BODY, context: "secondary text on card" },
  { theme: "platform-dark", fg: "--cw-platform-accent-contrast", bg: "--cw-platform-accent", min: AA_LARGE, context: "CTA label on gold fill (large/semibold)" },
  { theme: "platform-dark", fg: "--cw-platform-accent-contrast", bg: "--cw-platform-accent-strong", min: AA_LARGE, context: "CTA label on strong accent (large/semibold)" },
  { theme: "platform-dark", fg: "--cw-platform-on-accent", bg: "--cw-platform-accent", min: AA_BODY, context: "ink label on gold CTA (lighter gradient stop)" },
  { theme: "platform-dark", fg: "--cw-platform-on-accent", bg: "--cw-platform-accent-pressed", min: AA_BODY, context: "ink label on deep-gold CTA (darker stop / hover)" },
];

// --- Material (M1 glass) -----------------------------------------------------
// Glass has no fixed background: whatever scrolls under it shows through. The
// pair that must hold is text over the tint composited on the worst backdrop
// that context allows, and there are two contexts:
//
//   over canvas (topbar, cards on the page) — backdrop is always the warm
//     canvas, so its worst case is --cw-sem-calm-surface-muted / the dark
//     theme's brightest surface. Tint floor 76% carries body AND muted text.
//   over media (panels on a photo) — backdrop can be anything a photograph
//     contains, so the worst case is genuinely black (light) or white (dark).
//     Body ink is dark enough to survive almost any tint there, so the binding
//     constraint is the muted label: it clears only the large/semibold tier
//     (3.0) and only at --cw-mat-tint-media (86%). Hence the DS rule — muted
//     text on glass-over-media must be large/semibold — and hence the media
//     floor is asserted through that pair, which is the one that actually moves.
//
// Lower a floor and this gate fails. That is why the floors are tokens.
//
// Translucent foregrounds (the muted inverse label) are composited too, over the
// panel they live on, rather than being compared as if they were opaque.
const glassPairs = [
  {
    theme: "light", fg: "--cw-platform-text",
    glass: { tint: "--cw-mat-surface", alpha: "--cw-mat-tint-floor", over: "--cw-sem-calm-surface-muted" },
    min: AA_BODY, context: "body text on M1 glass over worst-case canvas",
  },
  {
    theme: "light", fg: "--cw-platform-muted",
    glass: { tint: "--cw-mat-surface", alpha: "--cw-mat-tint-floor", over: "--cw-sem-calm-surface-muted" },
    min: AA_BODY, context: "secondary text on M1 glass over worst-case canvas",
  },
  {
    theme: "light", fg: "--cw-platform-text",
    glass: { tint: "--cw-mat-surface", alpha: "--cw-mat-tint-media-floor", over: "#000000" },
    min: AA_BODY, context: "body text on M1 glass over worst-case photo (black)",
  },
  {
    theme: "light", fg: "--cw-platform-muted",
    glass: { tint: "--cw-mat-surface", alpha: "--cw-mat-tint-media-floor", over: "#000000" },
    min: AA_LARGE, context: "muted label on M1 glass over worst-case photo (large/semibold only)",
  },
  {
    theme: "dark", fg: "--cw-text",
    glass: { tint: "--cw-mat-surface", alpha: "--cw-mat-tint-floor", over: "--cw-surface-solid" },
    min: AA_BODY, context: "body text on M1 glass over worst-case canvas",
  },
  {
    theme: "dark", fg: "--cw-muted",
    glass: { tint: "--cw-mat-surface", alpha: "--cw-mat-tint-floor", over: "--cw-surface-solid" },
    min: AA_BODY, context: "secondary text on M1 glass over worst-case canvas",
  },
  {
    theme: "dark", fg: "--cw-text",
    glass: { tint: "--cw-mat-surface", alpha: "--cw-mat-tint-media-floor", over: "#ffffff" },
    min: AA_BODY, context: "body text on M1 glass over worst-case photo (white)",
  },
  {
    theme: "dark", fg: "--cw-muted",
    glass: { tint: "--cw-mat-surface", alpha: "--cw-mat-tint-media-floor", over: "#ffffff" },
    min: AA_LARGE, context: "muted label on M1 glass over worst-case photo (large/semibold only)",
  },
  {
    theme: "platform-dark", fg: "--cw-platform-text",
    glass: { tint: "--cw-mat-surface", alpha: "--cw-mat-tint-floor", over: "--cw-platform-surface-muted" },
    min: AA_BODY, context: "body text on M1 glass over worst-case canvas",
  },
  {
    theme: "platform-dark", fg: "--cw-platform-muted",
    glass: { tint: "--cw-mat-surface", alpha: "--cw-mat-tint-floor", over: "--cw-platform-surface-muted" },
    min: AA_BODY, context: "secondary text on M1 glass over worst-case canvas",
  },
  {
    theme: "platform-dark", fg: "--cw-platform-text",
    glass: { tint: "--cw-mat-surface", alpha: "--cw-mat-tint-media-floor", over: "#ffffff" },
    min: AA_BODY, context: "body text on M1 glass over worst-case photo (white)",
  },
  {
    theme: "platform-dark", fg: "--cw-platform-muted",
    glass: { tint: "--cw-mat-surface", alpha: "--cw-mat-tint-media-floor", over: "#ffffff" },
    min: AA_LARGE, context: "muted label on M1 glass over worst-case photo (large/semibold only)",
  },
  // --- Tone-managed chrome (the topbar) ------------------------------------
  // The topbar is not "glass over arbitrary media": headerTone samples what is
  // actually behind it and flips the palette at luminance 0.34. Its backdrop is
  // therefore bounded, and holding it to the media floor would be false rigour —
  // it would force an opaque bar for a risk that cannot occur. The bound used
  // here is #b0b0b0 (luminance ~0.42), a margin past the switch point to cover a
  // backdrop that is mixed under different parts of the bar.
  //
  // The trade is explicit: a transparent tint is paid for with full-strength
  // labels. The nav's secondary state runs at 86-90% of the foreground, not the
  // 62-78% a solid surface would allow, and that is what these pairs assert.
  {
    theme: "light", fg: "--cw-platform-text",
    glass: { tint: "--cw-mat-surface", alpha: "--cw-mat-tint-chrome-floor", over: "#b0b0b0" },
    min: AA_BODY, context: "topbar label on chrome glass, light tone, at the tone bound",
  },
  {
    theme: "header-dark", fg: "--cw-platform-accent-contrast",
    glass: { tint: "--cw-mat-surface", alpha: "--cw-mat-tint-chrome-floor", over: "#b0b0b0" },
    min: AA_BODY, context: "topbar label on chrome glass, dark tone, at the tone bound",
  },
  {
    theme: "header-dark",
    // the nav's secondary state, written inline in PlatformShell.module.css
    fg: "color-mix(in srgb, var(--cw-platform-accent-contrast) 90%, transparent)",
    glass: { tint: "--cw-mat-surface", alpha: "--cw-mat-tint-chrome-floor", over: "#b0b0b0" },
    min: AA_BODY, context: "topbar secondary nav label on chrome glass, dark tone",
  },
  {
    theme: "light",
    fg: "color-mix(in srgb, var(--cw-platform-text) 86%, transparent)",
    glass: { tint: "--cw-mat-surface", alpha: "--cw-mat-tint-chrome-floor", over: "#b0b0b0" },
    min: AA_BODY, context: "topbar secondary nav label on chrome glass, light tone",
  },
  // Inverse panel: the gradient's lighter stop is the harder ground for its text.
  {
    theme: "light", fg: "--cw-mat-inverse-text",
    glass: { plain: "#274a3c" },
    min: AA_BODY, context: "text on inverse mineral panel (lighter gradient stop)",
  },
  {
    theme: "light", fg: "--cw-mat-inverse-text-muted", fgOver: "#274a3c",
    glass: { plain: "#274a3c" },
    min: AA_BODY, context: "muted label on inverse mineral panel (lighter gradient stop)",
  },
  // --- way21 phyto card -----------------------------------------------------
  // These pairs predate the photo ground and outlive it: the card once carried a
  // duotone photo crushed to 0.051 luminance so it would stay under the panel's
  // lighter gradient stop #274a3c (0.057). The photo is gone (2026-08-17) — the
  // imagery moved to the phase cards, above the copy — but #274a3c is still the
  // real ground, because it is the panel's own gradient. So the pairs stand as
  // written. The card's text is literal rgba() in landing.css, restated here as
  // color-mix so the gate composites it.
  {
    theme: "light", fg: "color-mix(in srgb, #ffffff 82%, transparent)", fgOver: "#274a3c",
    glass: { plain: "#274a3c" },
    min: AA_BODY, context: "way21 phyto card body text on graded photo ground",
  },
  {
    theme: "light", fg: "color-mix(in srgb, #ffffff 60%, transparent)", fgOver: "#274a3c",
    glass: { plain: "#274a3c" },
    min: AA_BODY, context: "way21 phyto card phase subtitle on graded photo ground",
  },
  {
    theme: "light", fg: "#a7c1ad",
    glass: { plain: "#274a3c" },
    min: AA_BODY, context: "way21 phyto card mono row label on graded photo ground",
  },
  {
    theme: "light", fg: "color-mix(in srgb, #ffffff 62%, transparent)", fgOver: "#274a3c",
    glass: { plain: "#274a3c" },
    min: AA_BODY, context: "way21 card fine print (scoped bump from the shared .45 default)",
  },
  // --- network photo hero (data-cw-hero="photo") ----------------------------
  // The copy band sits on .wrap::before — the brand dark at 92%, over the
  // photograph. A photo can contain a pure white pixel, so that is the backdrop
  // asserted here; anything darker in the image only helps. These four pairs are
  // the hero's whole on-dark palette (--cw-net-hero-ink / -ink-soft / -ink-label
  // / -accent). Thin the 92% scrim and this is what catches it.
  {
    theme: "light", fg: "#ffffff",
    glass: { tint: "#173027", alpha: 0.92, over: "#ffffff" },
    min: AA_BODY, context: "photo hero title on the copy-band scrim over a white photo pixel",
  },
  {
    theme: "light", fg: "#cfe0d3",
    glass: { tint: "#173027", alpha: 0.92, over: "#ffffff" },
    min: AA_BODY, context: "photo hero lead/trust text on the copy-band scrim",
  },
  {
    theme: "light", fg: "#a7c1ad",
    glass: { tint: "#173027", alpha: 0.92, over: "#ffffff" },
    min: AA_BODY, context: "photo hero mono price label on the copy-band scrim",
  },
  {
    theme: "light", fg: "#e0b25c",
    glass: { tint: "#173027", alpha: 0.92, over: "#ffffff" },
    min: AA_BODY, context: "photo hero accent (title emphasis, trust tick) on the copy-band scrim",
  },
  // --- network nav ----------------------------------------------------------
  // Light tone: the bar and its drawer run the chrome tint (55%) over the page
  // canvas. That transparency is affordable because the backdrop is bounded —
  // the bar steps aside over a photo hero, and any section that is not the light
  // canvas declares itself with data-cw-nav-dark. The worst light ground is the
  // network's chip surface.
  {
    theme: "light", fg: "#1d3a30",
    glass: { tint: "#fbf9f2", alpha: 0.55, over: "#e4efe7" },
    min: AA_BODY, context: "nav ink label on the light-tone bar over the worst network canvas",
  },
  {
    theme: "light", fg: "#3f6f63",
    glass: { tint: "#fbf9f2", alpha: 0.55, over: "#e4efe7" },
    min: AA_BODY, context: "nav accent (hover/current) on the light-tone bar",
  },
  // Dark tone: backdrop is a declared dark section, so the worst ground is the
  // lightest stop of a skin's dark gradient — reset-day's #356152, not white.
  // That is what lets the night tint stay at 42% and still read as glass.
  {
    theme: "light", fg: "#ffffff",
    glass: { tint: "#173027", alpha: 0.42, over: "#356152" },
    min: AA_BODY, context: "nav brand/ink on the dark-tone bar over the lightest dark-section stop",
  },
  {
    theme: "light", fg: "#cfe0d3",
    glass: { tint: "#173027", alpha: 0.42, over: "#356152" },
    min: AA_BODY, context: "nav link label on the dark-tone bar",
  },
  {
    theme: "light", fg: "#e0b25c",
    glass: { tint: "#173027", alpha: 0.42, over: "#356152" },
    min: AA_BODY, context: "nav accent (hover/current/focus ring) on the dark-tone bar",
  },
  {
    theme: "light", fg: "#cfe0d3",
    glass: { tint: "#173027", alpha: 0.66, over: "#356152" },
    min: AA_BODY, context: "nav link label in the dark-tone drawer panel",
  },
  {
    theme: "light", fg: "#1d3a30",
    glass: { tint: "#fbf9f2", alpha: 0.76, over: "#e4efe7" },
    min: AA_BODY, context: "nav link label in the light-tone drawer panel",
  },
  // The footer lockup now runs the same gold word the dark-tone bar does. Not
  // glass — the footer is the solid --cw-net-text of the skin, and the worst
  // (lightest) one across the five network landings is #2f4536.
  {
    theme: "light", fg: "#e0b25c",
    glass: { plain: "#2f4536" },
    min: AA_BODY, context: "gold footer wordmark on the lightest network footer ground",
  },
];

// The topbar over a dark hero: a light page whose header carries the material's
// dark half via [data-cw-header-tone="dark"]. Light platform palette, dark
// material — exactly what the DOM resolves there.
const headerDarkMap = buildMap(
  tokens.base?.light,
  tokens.layers?.semanticAliases,
  tokens.layers?.modeOverrides?.platform,
  tokens.layers?.material?.light,
  tokens.layers?.material?.dark,
);

const maps = {
  light: lightMap,
  dark: darkMap,
  "platform-dark": platformDarkMap,
  "header-dark": headerDarkMap,
};

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

// Source-over compositing of an rgb layer at `alpha` (0..1) onto an opaque one.
function composite(layer, alpha, backdrop) {
  return [0, 1, 2].map((i) => Math.round(layer[i] * alpha + backdrop[i] * (1 - alpha)));
}

// Reads a percentage token like "76%" (or a bare number) as 0..1.
function resolveAlpha(value, map) {
  const raw = String(map.get(value) ?? value).trim();
  const pct = raw.match(/^(\d+(?:\.\d+)?)%$/);
  if (pct) return parseFloat(pct[1]) / 100;
  const num = Number(raw);
  return Number.isFinite(num) && num > 0 && num <= 1 ? num : null;
}

// A translucent token (color-mix(... N%, transparent)) resolves to its opaque
// tint via resolve(); re-apply the N% over the given backdrop to get the pixel.
function flattenTranslucent(value, map, backdrop) {
  const raw = String(value ?? "").trim();
  const mix = raw.match(/^color-mix\(in srgb,\s*(.+?)\s+(\d+(?:\.\d+)?)%\s*,\s*transparent\s*\)$/);
  if (!mix) return resolve(raw, map);
  const tint = resolve(mix[1], map);
  if (!tint) return null;
  return composite(tint, parseFloat(mix[2]) / 100, backdrop);
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

for (const { theme, fg, fgOver, glass, min, context } of glassPairs) {
  const map = maps[theme];
  let bgRgb = null;

  if (glass.plain) {
    bgRgb = resolve(glass.plain, map);
  } else {
    const tint = resolve(map.get(glass.tint) ?? glass.tint, map);
    const alpha = resolveAlpha(glass.alpha, map);
    const backdrop = resolve(map.get(glass.over) ?? glass.over, map);
    if (tint && alpha && backdrop) bgRgb = composite(tint, alpha, backdrop);
  }

  const fgRgb = bgRgb ? flattenTranslucent(map.get(fg) ?? fg, map, resolve(fgOver, map) ?? bgRgb) : null;
  if (!fgRgb || !bgRgb) {
    failures.push(`Unresolved ${theme} material pair ${fg} (${context})`);
    continue;
  }

  const ratio = contrastRatio(fgRgb, bgRgb);
  const ok = ratio >= min;
  const ground = glass.plain ?? `${glass.tint}@${glass.alpha} over ${glass.over}`;
  lines.push(`${ok ? "  ok" : "FAIL"} [${theme}] ${ratio.toFixed(2)} (min ${min}) ${fg} on ${ground} — ${context}`);
  if (!ok) {
    failures.push(`[${theme}] ${fg} on ${ground} = ${ratio.toFixed(2)}, below required ${min} (${context})`);
  }
}

for (const line of lines) console.log(line);

if (failures.length > 0) {
  console.error("\n[FAIL] Contrast guard");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("\n[PASS] Contrast guard");
