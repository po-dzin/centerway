# CenterWay Design System — Living Reference

## Status

Living operational reference. Supersedes the archived snapshots:

- `docs/archive/working-notes/design-system-spec-2026-05-17.md`
- `docs/archive/reference/design-system-brandbook-extract-2026-06-27.md`

Authority order: RAverse canon (`/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/**`) > this file > archived notes. This file describes the system **as implemented**; aspirational concepts are listed explicitly in the ledger at the bottom, never mixed into the descriptive sections.

Simplification roadmap: `docs/archive/working-notes/ds-simplification-plan-2026-07-03.md` (all stages applied).

Rendered styleguide: `docs/design-system.styleguide.html` — self-contained HTML showing every layer live (primitives → semantic → platform → recipes → delivery), the block vocabulary, the contrast-gate results, and a live 5-pack theme switcher demonstrating per-author scaling. Values are copied from `cw.tokens.json` + generator manifests; regenerate when tokens change.

## System Definition

CenterWay DS is a semantic token system plus a contract-governed screen generator. Build chain as implemented:

```
cw.tokens.json (layers) ──tokens:build──▶ globals.css (:root / .dark)
token_packs.json ──themeCatalog.ts──▶ generator themes
generator manifests (contracts → screens → blocks → semantic blocks) ──▶ funnel surfaces
```

The generated CSS is intentionally flat: layering lives in the JSON source and in this document, not in the runtime artifact.

Codegen-owned marker blocks in `globals.css` (never edit by hand — edit `cw.tokens.json` and run `tokens:build`): `CW_BASE_LIGHT`, `CW_BASE_DARK`, `CW_RUNTIME_TOKENS`, `CW_MATERIAL_DARK`, `DS_ALIAS_LIGHT`, `DS_ALIAS_DARK`. Hand-maintained remainder: `--cw-platform-visual-*` gradient stops, the `[data-cw-material]` / `[data-cw-glass]` recipes, and everything outside `@layer base` token blocks.

The generator emits `name: value` pairs only — **comments cannot round-trip through it**. Notes that used to live inside a marker block belong here instead. Carried over 2026-08-15: the brand symbol stays the original CenterWay figure emblem, while the wordmark carries the new identity's "CenterWay" + MOVE · BALANCE · GROW tagline; wordmark aspect is 541.3:129.3 ≈ 4.19 — keep `--cw-brand-size-wordmark-*-width/height` in that ratio.

## Vocabulary — the one table

The word "semantic" covers **three different axes** in this codebase. They are consistent with each other (verified per-block 2026-07-03), but they answer different questions. Never use one axis's values in another's field.

| Axis | Question it answers | Values | Where it lives |
|---|---|---|---|
| **Content role** (`semantic_role`) | What job does this block do in the page's information architecture? | `orientation`, `method`, `offer`, `proof`, `boundary`, `progress`, `route-map` | `block_manifests.json` |
| **Block family** (`semantic_family` / `family`) | Which reusable block lineage is this? | `orientation`, `offer_route`, `method_explanation`, `trust_proof_expectation`, `boundary_caution`, `progress_pathway` | `block_manifests.json` + `semantic_block_layer.json` (identical values, verified) |
| **Visual tone** (`primary_semantic`, `semantic_tags`, `token_recipes`) | Which token mood does this block render with? | `calm`, `method`, `guide`, `trust`, `embodied`, `progress`, `boundary`, `warmth` | `semantic_block_layer.json`, `--cw-sem-*` tokens, `token_recipes: semantic.*` |

Per-block mapping as implemented (source: `block_manifests.json` × `semantic_block_layer.json`):

| Block type | Content role | Family | Primary visual tone |
|---|---|---|---|
| hero-entry-definition | orientation | orientation | guide |
| current-step | orientation | orientation | progress |
| route-framing | method | orientation | guide |
| how-it-works | method | method_explanation | method |
| practice-unit | method | method_explanation | method |
| offer-definition | offer | offer_route | guide |
| offer-includes | offer | offer_route | method |
| format-duration-price | offer | offer_route | trust |
| proof-block | proof | trust_proof_expectation | trust |
| boundary-block | boundary | boundary_caution | boundary |
| next-step | progress | progress_pathway | guide |
| route-choice | route-map | progress_pathway | guide |

## Token Layer Map

Target architecture is three layers (see roadmap stage 3). Current state, prefix by prefix:

| Prefix | Layer | Source of truth | Consumers | Guarded by |
|---|---|---|---|---|
| `--cw-bg/text/accent/status-*` etc. | app-chrome base (light `:root` + admin dark `.dark`) | `cw.tokens.json` → `base.light` / `base.dark` (codegen-owned since 2026-07-03) | app/admin components, DS delivery refs | tokens:check (drift), canon:guard (hex allowlist) |
| `--cw-sem-*` | semantic (visual roles) | `cw.tokens.json` → `layers.semanticAliases` | platform component CSS | canon:guard (hex allowlist only) |
| `--cw-platform-*` | mode alias over semantic (`visual-*` gradients stay hand-maintained in `globals.css`) | `cw.tokens.json` → `layers.modeOverrides.platform` | platform shell/blocks | canon:guard (hex allowlist only) |
| `--cw-depth-*`, `--cw-component-glass-*` | component recipes | `cw.tokens.json` → `layers.componentRecipes` | platform components | canon:guard |
| `--cw-mat-*` | **material** (tactile surface layer; light + dark halves) | `cw.tokens.json` → `layers.material.{light,dark}` (codegen-owned: `CW_RUNTIME_TOKENS` / `CW_MATERIAL_DARK`) | `[data-cw-material]` recipe in `globals.css`; platform shell (topbar, mobile menu, profile card, hero controls) | guard:contrast (glass pairs), canon:guard |
| `--cw-platform-*` dark half | public dark palette | `cw.tokens.json` → `layers.modeOverrides.platformDark` (codegen-owned: `CW_PLATFORM_DARK`) | `[data-cw-theme="dark"]` — authored, no switch wired | guard:contrast (`platform-dark` theme) |
| `--ds-*` | delivery alias | `cw.tokens.json` → `delivery.dsAlias` (full contract incl. type/button/offer-card scales; codegen-owned since 2026-07-03) | platform + landing bridge | guard:ds-contract (required-token list), tokens:check |
| `--cw-role-*`, `--cw-cta-*` | generator theme packs | `token_packs.json` | **none yet** — wired into `themeCatalog.ts`, zero CSS consumers; designated per-author theming mechanism, activation deferred until a second real theme exists | generator:validate |
| `--cw-net-*` | platform-author network skin | `shared/css/network-tokens.css` — **references** `--cw-sem-*` / `--cw-mat-*`, no longer copies their values | the five landings | tokens:check (drift of the generated source) |
| `--landing-*`, `--product-*`, irem `--color-*` | isolated landing themes | `src/landing-static/**` (hand-maintained) | Short/IREM landings only | guard:ds-contract (cross-layer consumption bans) |

Removed layers: `--cw-color-*` (legacy DS bridge, `appAlias`) was deleted 2026-07-03 — it had zero component consumers. Do not reintroduce the prefix.

Rules that hold today:

- No raw hex in platform component CSS outside the allowlist derived from token sources (canon:guard).
- Landing CSS must not consume `--ds-color-*`, `--product-*`, `--legacy-color-*` cross-layer (guard:ds-contract).
- `tokens:build` must be a no-op on a clean tree (`tokens:check` in `ds:qa`); edit `cw.tokens.json`, never the generated blocks in `globals.css`.
- Landing isolation (Short/IREM own their theme files) is an **author boundary**, not tech debt — do not "unify" it.

### Consumption contract (which tier a component may read)

Platform components legitimately consume **three** tiers, and that is by design — not drift. Measured today: `--cw-platform-*` in 9 modules, `--ds-*` in 8, `--cw-sem-*` in 6.

| Tier | A component may read it when… |
|---|---|
| `--cw-platform-*` | it needs the platform's resolved surface/text/accent (the default for platform chrome). |
| `--cw-sem-*` | it needs a specific visual *role* the platform alias doesn't expose (e.g. `boundary`, `progress`, `embodied` accents inside a block). |
| `--ds-*` | it needs a delivery-level primitive shared with landings (type scale, spacing, radius, touch target). |
| `--cw-*` chrome (`--cw-bg/text/accent/…`) | admin/dark surfaces only — the base theme layer. |

Forbidden from components regardless of tier: `layers.primitives.*` (raw mineral colors), raw hex, and any locally-defined `--cw-*` token (canon:guard enforces the last two on platform CSS). The rule of thumb: reach for the **highest** tier that already answers the need; drop a tier only when the one above doesn't expose the role.

## Material layer (tactile surfaces)

Added 2026-08-15 as the first step of the tactile redesign (research: `docs/archive/working-notes/ds-tactile-redesign-research-2026-08-15.md`). One glass, not a ladder of them — the decision was explicitly "одно среднее стекло", warm and grainy.

| Variant (`data-cw-material`) | Material | Where |
|---|---|---|
| `matte` | opaque warm ground (`--cw-mat-surface`), no blur | reading surfaces, forms, dense text |
| `glass` | tint 76% + `blur(34px) saturate(1.18)` | cards, chips — anything over the page canvas |
| `glass-media` | tint 86%, raised shadow | panels sitting over a photo |
| chrome tint 55% | the same glass, far more transparent, **no stroke** | the topbar — see below |
| `inverse` | dark mineral gradient `#173027 → #274a3c` | offer blocks — the night side of the same material |
| tones | the material shifted by a semantic hue: `--cw-mat-tone-{support,proof,boundary,icon}` | role-tinted panels, icon slots, boundary notes |
| inverse controls | `--cw-mat-inverse-control` — a darkening scrim | chips and ghost buttons sitting **on** dark media inside a light page |

Shared by all: 1px light stroke, two-part shadow, and an SVG grain that is what makes the surface read as matte rather than plastic. There is deliberately no inset top highlight — an earlier pass (`--cw-mat-highlight`, an `inset 0 1px 0` white line) read as glossy shine rather than matte glass and was removed network-wide 2026-08-17; see the note under "Material on the network surfaces".

The grain is **one token, `--cw-mat-grain-image`, carrying its own strength** (alpha baked into the SVG: 0.05 light, 0.16 dark). It is applied with a single `background-image` declaration and nothing else. This is deliberate: an earlier split into image + `opacity` + `mix-blend-mode` meant a surface that set only the image got the grain at full strength — which turned the topbar into grey sandpaper (measured: `#f6f2ea` page vs `#d1cdc6` bar). One declaration cannot be half-applied.

**Why two glass tints and not one.** Glass has no fixed background, so contrast must hold against the worst backdrop the context allows, and there are two contexts. Over the canvas the backdrop is always the warm page, so 76% carries body *and* muted text. Over a photo the backdrop can be anything a photograph contains — measured against black, body ink still clears AA at 11.83, but the muted label only reaches 3.83. Hence the rule and the second tint:

- muted/secondary text on `glass-media` must be **large/semibold** (WCAG large tier, the same treatment CTA fills already get);
- `--cw-mat-tint-floor` (76%) and `--cw-mat-tint-media-floor` (86%) are tokens precisely so `guard:contrast` can assert them. Lowering either fails the gate — verified by regression test.

Degradation is part of the contract: `@supports not (backdrop-filter)` and `prefers-reduced-transparency: reduce` both fall back to the opaque `--cw-mat-surface`, whose contrast is strictly better than the glass it replaces. One glass depth only — never nest glass in glass.

### The chrome tint, and why the topbar is not held to the media floor

The topbar reads as **matte but transparent, with no outline**: the blur and the grain carry the material, the tint stays out of the way, and there is no 1px stroke — a bordered bar reads as a component pasted on the page rather than a surface floating over it.

That is affordable because the topbar is **tone-managed**, which the media floor's reasoning does not account for. `headerTone` samples what is actually behind the bar and flips its palette at luminance 0.34, so the backdrop is bounded rather than arbitrary. Holding it to the 86% media floor would be false rigour: it forces an opaque bar to defend against a backdrop the tone switch already prevents. `guard:contrast` asserts the topbar against `#b0b0b0` (luminance ≈ 0.42, a margin past the switch point, covering a backdrop that is mixed under different parts of the bar).

The trade is explicit and enforced: **transparency is paid for with full-strength labels.** The topbar's secondary nav state runs at 86–90% of the foreground, never the 62–78% a solid surface would allow. Measured at the tone bound: primary label 12.19 (light) / 5.41 (dark), secondary 8.77 / 4.76. Lower the chrome floor or dilute the labels and the gate fails.

### Two rules about `backdrop-filter` that this codebase learned the hard way

Both were live defects found while migrating the topbar (2026-08-15). Neither is obvious from reading CSS, and each silently produced a *plausible-looking* wrong result.

1. **Never hand-write `-webkit-backdrop-filter`.** lightningcss (Next's CSS pipeline) collapses the pair `backdrop-filter: X; -webkit-backdrop-filter: X` into the prefixed property *only* — and Blink no longer honours that alias (`CSS.supports('-webkit-backdrop-filter', …)` → `false`). The net effect was that **every `backdrop-filter` in the platform was dead in Chrome**, including the topbar's. 22 such lines were removed; the build adds a prefix itself when a target needs one. Adding the line back turns the glass off again, invisibly.

2. **`backdrop-filter` makes an element a containing block for `position: fixed` descendants**, and `isolation: isolate` makes it a Backdrop Root that neuters any blur inside it. The topbar is caught between the two: it contains a fixed full-screen mobile menu, so the blur cannot live on `.header` (the menu collapses to bar height), and it cannot live on a pseudo-element under `isolation` (nothing renders). The band therefore sits on `.header::before` with no `isolation` above it. Both constraints are commented at the rule.

Together these explain the retired frost-image hack: a blurred copy of a photo pinned behind the header, faking the effect that the build was stripping. It was dead code by the time it was removed (`content: none` on every consumer).

### Public dark mode: authored, scoped, not switched on

`--cw-platform-*` now has a dark half (`layers.modeOverrides.platformDark`), so a dark public surface renders correctly. It lives under **`[data-cw-theme="dark"]`, deliberately not `.dark`**:

`ThemeSwitcher` writes `.dark` onto `<html>` and persists it in `localStorage`. It is mounted only in admin, but the class survives client-side navigation out of `/admin` onto public routes. Keying the public palette off `.dark` would therefore darken the whole site for anyone who has visited admin. The two scopes are separate for that reason, and the comment beside them in `globals.css` says so.

Three selectors share the material dark half: `.dark` (admin), `[data-cw-theme="dark"]` (public, unset today), and `[data-cw-header-tone="dark"]` — the last is not a theme but a *local context*, letting the topbar flip to the night material while the page around it stays light.

`guard:contrast` checks the public dark palette as a third theme (`platform-dark`, 11 pairs) at the same bar as light. Nothing sets `data-cw-theme` yet: the palette is authored and gated, not shipped half-on. Adding the toggle is a product decision, not a token one.

### The landing network reads the platform's tokens instead of copying them

The five platform-author landings (`way21`, `reset-day`, `dosha`, `consult`, `herbs`) are static hosts that never load `globals.css`, so `--cw-net-*` used to mirror the platform palette **by value** — a copy that silently diverges the first time a colour is retuned. As of 2026-08-15 the copy is gone:

```
cw.tokens.json ──tokens:build──▶ globals.css                       (platform)
               └────────────────▶ shared/css/cw-tokens.generated.css (network)
                                        │  loaded first on all five landings
                                        ▼
                                  network-tokens.css → var(--cw-sem-*), var(--cw-mat-*)
```

The generated file carries the colour subset only — `--cw-sem-*` (minus the symbol gradients) plus the full material, in both halves. Brand-asset URL tokens are deliberately excluded: they point at `/cw/**`, which the funnel hosts do not serve.

Every reference keeps its literal fallback (`var(--cw-sem-warmth, #dba54f)`), so a missing generated file degrades to the old palette rather than blanking a landing. Per-landing skins still override the `--cw-net-*` defaults — the network keeps its role tints, it just no longer keeps its own copy of the base.

Verified end to end: changing `--cw-sem-warmth` in the JSON moves `--cw-net-gold` on the deferred landings, and reverting moves it back. `tokens:check` now diffs the generated file too, so drift fails the gate.

#### Type and button shape: all five landings migrated

The whole network runs the platform's own faces — Cormorant Garamond (display), Manrope (UI), IBM Plex Mono (data). **Formular is retired from the network** and now belongs to Short/IREM only, which is the author boundary anyway. Its `@font-face` set is gone from `landing.css` and the `way21` / `reset-day` critical-path `preload` links for it were removed — a high-priority fetch of a face nothing uses.

Serving them off-platform needed one move: the funnel hosts cannot reach `/fonts/**` (not a landing static brand), so the woff2 set is copied to `src/landing-static/shared/fonts/platform/` with `shared/css/platform-fonts.css` pointing at it. `/shared/**` is the one prefix both the platform host and all five funnel hosts serve. Keep that file in sync with `src/app/platform-fonts.css`.

Two things travel **with** the family rather than being left behind on it:

- **Metrics.** Formular is a sans that wants tight negative tracking; a serif at display size does not. `--f-display-track` / `--f-display-leading` / `--f-display-weight` carry the serif's own values. They keep sans defaults in `landing.css` so the tokens stay usable by any future skin that goes back to a grotesque.
- **Figures.** Cormorant defaults to old-style numerals: `21 день` rendered as `2I день` and a price as `4ıoo`. The numbers on these pages are data — days, prices, kilograms — so every rule taking `--f-display` also takes `font-variant-numeric: var(--f-display-nums, normal)`, set to `lining-nums` in the migrated scope.

Button shape is now one value for platform and network: `--r-btn: 1rem` in `network-tokens.css`, mirroring `--ds-radius-button-soft`. Soft rect everywhere, never pill.

#### Material on the network surfaces

Depth is rebound rather than rewritten: `--shadow-soft` / `--shadow-med` — which feed every card, panel and hover state in `landing.css` — now resolve to `--cw-net-mat-shadow` / `-raised`. One binding moved 19 call sites.

**2026-08-17: `--cw-mat-highlight` (the `inset 0 1px 0` white top-edge line) is gone, everywhere the material is used** — author call: it read as glossy shine, not matte glass, and the whole point of this material is that it isn't glossy. It was previously folded into `--shadow-soft`/`--shadow-med` and into the `[data-cw-material]` base rule's `box-shadow`; both now carry shadow only. Removed from `layers.material.{light,dark}` in `cw.tokens.json` and from every hand-written consumer (`globals.css`, `PlatformComponents.module.css`, `network-nav.css`, `network-tokens.css`) — it was never purely a token, some call sites concatenated it onto a shadow by hand, so a token-only removal would have left the line rendering from its literal fallback.

Card faces lost their `1px solid var(--line)` and gained a resting shadow, mirroring the platform's own card recipe (`--cw-mat-surface` + `--cw-mat-shadow-soft`, no border). Structural lines — dividers, dashed rules, the `.strip` band — stay. Worth stating why the border could go at all: on several cards the hairline was the *only* edge, with a shadow appearing on hover, so removing it without adding a resting shadow made them vanish into the canvas. The border is decoration only once the material carries the edge.

The sticky CTA is chrome, so it takes the glass: chrome tint, material filter, grain, no top rule. The dark offer block takes `--cw-mat-inverse-bg` — the same gradient the platform's inverse panels use.

**2026-08-17: the hero badge/chips/hv-stat (`consult`/`herbs`/`dosha`) are one glass recipe, not two.** The hero badge moves between two backdrops — the cream page beside the photo (desktop), and the photo itself (mobile, plus `.hv-stat` always). The first pass gave the photo context a separate dark scrim (`--cw-mat-inverse-control`, 34% dark, light text) — the same token the platform's own `.heroBadge` uses. Checking it against the worst case found a real gap: over a bright photo region the composited background lands around a mid-light gray, and light text on it measures ~2.0 contrast against a 4.5 requirement. Bumping the scrim would fix it but changes the platform hero's look too, which is out of scope for the network migration alone. Instead the network badge/chips/`hv-stat` all use the same warm tint family as everywhere else, at the **media floor** (`--cw-mat-tint-media`, 86%, bridged as `--cw-net-mat-tint-media`) instead of the canvas floor (76%) when sitting on the photo, with the same dark ink text throughout. That pair is already the one `guard:contrast` holds to AA over both worst-case photo colors (see the `glass-media` pairs above), so no new gate entry was needed — and there is now exactly one hero-chip recipe, not a light one and a dark one.

The platform's own hero followed the same day: `.heroBadge` and `.heroSecondaryButton` in `PlatformBlocksOrientation.module.css` (used by `HubHero` and `PlatformDetailHero`) moved off `--cw-mat-inverse-control` onto the same `--cw-mat-tint-media` + `--cw-platform-text` recipe, and gained the `backdrop-filter` they never had. One badge recipe now spans platform and network. `--cw-mat-inverse-control` survives for `.shellOverlay .ghostButton` in `PlatformShell.module.css` — the topbar's ghost control in overlay mode. That one carries the same theoretical gap but is a different surface (tone-managed chrome, not a content badge) and was left alone deliberately.

### Gold is one colour, and now one token

`--cw-sem-warmth` (#dba54f) was already shared, but its two companions were not: the network hardcoded `--cw-net-gold-strong: #c2902f`, and the platform's hero CTA never used a flat gold at all — it ran `linear-gradient(135deg, accent 78% + accent-strong 22%, accent-strong)`. Since `--cw-platform-accent-strong` is the **dark green**, that ramp went gold→green and rendered as a muddy olive, reading as a different, older yellow beside the flat gold everywhere else.

Three tokens now carry it, all from the semantic layer: `--cw-sem-warmth` (fill), `--cw-sem-warmth-strong` (pressed/deep stop), `--cw-sem-on-warmth` (#0d1b17, the ink label — a property of the gold, not of the theme, so both light and dark platform maps point at the same value). The platform exposes them as `--cw-platform-accent` / `-accent-pressed` / `--cw-platform-on-accent`; `--cw-net-gold-strong` is now a reference rather than a copy.

The CTA keeps its gradient — it just stays inside the gold family (`accent → accent-pressed`). Both stops are asserted in `guard:contrast` (8.01 and 6.17 at body AA); the lighter stop binds. Note one thing deliberately left alone: `--cw-net-on-gold` (#1d3a30) is still the network's own ink-on-gold and two landings override it further. It clears AA at 5.59, and unifying it would restyle all five landings' CTA labels — a separate call.

### Hero photography: grade in the file, tint in the scrim

Two rules, both learned by undoing the opposite (2026-08-17, when the hub hero moved to the real practice photography):

1. **No CSS `filter` on hero photos.** The files under `src/landing-static/shared/img/` ship already graded — the "CenterWay v1" pass (desaturate, warm recomb, lifted black), applied once at export and carrying an embedded sRGB profile. The hero used to run `saturate(.82) contrast(1.08) brightness(.9) sepia(.08) hue-rotate(-6deg)` *on top* of that. Two grades stacked is what read as muddy rather than warm. Grade belongs in the asset; CSS does layout and legibility only.
2. **The tint is partial and directional, not a wash.** The old scrim was three full-coverage gradients — a 90° ink ramp, a 28% ink→28% accent layer over the whole frame, and a third guide/warmth wash — which together sat at roughly 45% opacity even on the side with no text. It is now one gradient shaped to where the text actually is (left column on desktop, top-down on mobile, transparent past ~74%), plus a single ≤9% brand hue to seat the image in the palette. Where a long title outruns the scrim, a tight low-alpha `text-shadow` buys the separation — cheaper than darkening the photograph.

**One hero plate at every breakpoint.** A first pass swapped in a vertical portrait below 900px via `<picture>`; that was reverted — the hero is a single shared image and the breakpoints only re-frame it (`--hero-photo-x/y/scale`). The portrait is not hero furniture: it belongs to the author sections (platform "Про автора", the landings' author block) and to the consultation hero, where the subject *is* the author. Mixing the two put a different photograph behind the same headline depending on window width.

Photo roles, as wired:

| Asset | Where |
|---|---|
| `practice-group-2026-08.webp` (16:10) | platform hub hero, dosha hero — the shared hero plate |
| `author-evgeniy-2026-08.webp` (13:16) | consult hero, platform "Про автора", author block on consult / way21 / reset-day |

Note for the asset pipeline: `sharp.withIccProfile('srgb')` does **not** survive WebP encoding — a final `webpmux -set icc` is required, or the untagged file renders a different white on P3 displays (the iOS seam bug). The shipped files carry ICC; verify with `sharp(...).metadata().icc` after any re-encode.

#### The imagery pipeline

Two commands, and every image entering the project goes through the second one whether it was generated or shot.

| Command | What it does |
|---|---|
| `npm run img:generate -- --role … --subject … --ref …` | New frames through the Vercel AI Gateway. Auth is the OIDC token from `vercel env pull .env.vercel.local --yes` — pull to *that* file, never over `.env.local`, which holds local-only secrets the pull would drop. The token lasts ~24h; re-pull when generation starts failing on auth. |
| `npm run img:grade -- in.png --out …webp` | The "CenterWay v1" grade, then the mandatory `webpmux -set icc`, then a verification read that throws if the profile did not stick. `--grade` on the generator chains both. |

The photography contract from the research (light, palette, materials, "≤3 objects, air where the text goes") lives in `scripts/img/generate.mjs` as the prompt preamble, not in anyone's notes — that is what makes a set a series.

**Generate against references, not from prose.** With `--ref`, the request goes to a multimodal model with the approved frames attached and reads "a new frame in that same series"; without it, a pure image model renders from the prompt and style drifts frame to frame. Verified 2026-08-17: a light/dark backdrop pair generated this way came back with the same vase, bowl, stone, dish and sage sprig, mirrored so the text column swaps sides. Text mode is for exploration only.

Output lands in `public/cw/img/_staging/` and is wired to nothing. Promoting a frame is a separate, deliberate step — and for anything a funnel host must see, the destination is `src/landing-static/shared/img/`, since those hosts cannot read `/cw/**`.

**What a product frame shows is a fact, not a styling choice.** The way21 phase frames were first generated from the card copy, and weeks 1 and 2 came back with the same chamomile-and-rosehip jar because the copy does not say what is in the packet. The recipe lives in `Complete_3_Weeks_Detox_Program_V3.pdf` (outside the repo, in the author's media folder), so it is recorded here — any regeneration of `src/landing-static/shared/img/herbs/way21-week*.webp` must match it:

| Week | Containers | What is in them |
|---|---|---|
| 1 | one packet | Drainage blend #1: chamomile, calendula, rosehip, motherwort, corn silk |
| 2 | two containers, visibly different fills | Blend #2 — fennel, dill and caraway seeds, chicory and valerian root, elderflower and violet; plus a rose-beige fibre powder — psyllium, beet, apple |
| 3 | one packet | Spices only: ginger, turmeric, black pepper |

Week 2's card copy names two blends ("Збір №2 + Збір №3"); the frame shows one kraft packet and two containers with different contents. That is deliberate — the point of the frame is that the second week is two *different* things, not how many packets ship.

Packaging in generated frames stays plain unbranded kraft. Asked for real packaging, the model invents garbled Cyrillic labels — the prompt must say "no labels, no text, no lettering" every time.

One asymmetry worth knowing: landing CSS is served **raw**, not through Next's pipeline, so the hand-written `-webkit-backdrop-filter` lines there are harmless (verified: the served file is byte-identical to source). The lightningcss collapse that killed the platform's blur does not apply to `src/landing-static/**`.

#### One carrier per block

A **carrier** is what a block says something with besides its text: a **photo**, a **document** (a screenshot of a real message), an **icon**, or a **hand graphic**. A block gets one. Two of them compete for the same job and the reader cannot tell which is the point — way21's phase cards used to open with four at once (photo + accent stripe + icon chip + kicker), which is what started this.

Role decides which one:

| Block role | Carrier |
|---|---|
| hero, evidence | photo |
| structure (phases, route, the day) | hand graphic — or a photo band, never both |
| enumeration (what's included, what changes, who it's for) | icon |
| trust (author) | photo (portrait) |
| proof (testimonials) | document |
| pain, reframe, commerce, faq | typography — no carrier is the correct answer |

Two things that are *not* carriers. **Chrome**: chevrons, carousel arrows, the arrow inside a button. Excluded by glyph name; the few affordances that reuse a content glyph (a play badge on a video thumbnail, a check on a guarantee line) declare themselves with `class="ico ico-chrome"`. **Typography**: `★`, `✓`, `—` are characters — they take the type colour and metrics and stay. An emoji is a picture with its own palette that no stylesheet can reach, so `👋` and `☝️` are never carriers and the guard fails on them.

`npm run guard:carriers` enforces this per `<section>`. It runs on way21 only, because way21 is the one landing that has been through the pass; `node scripts/guard-carriers.mjs --report` prints the whole network, and the failures there are the backlog, not noise. Widen the npm script's `--surface` as each landing is converted.

The full role/carrier map across all five landings and the platform is in [ds-carrier-map-2026-08-17](archive/working-notes/ds-carrier-map-2026-08-17.md).

**Icons come from the sprite, not from the file.** 38 → 40 glyphs, baked from `scripts/lib/icon-glyphs.mjs`, emitted to `public/cw/icons/cw-icons.svg` (platform) and `src/landing-static/shared/img/cw-icons.svg` (funnel hosts, which cannot read `/cw/**`). Static landings reference it directly:

```html
<svg class="ico" width="20" height="20" aria-hidden="true" focusable="false"><use href="/shared/img/cw-icons.svg#cw-check"/></svg>
```

The glyph inherits `currentColor`, so colour is the call site's job and dark panels need no override. The carrier guard counts any inline `<svg>` that is not a brand mark as an icon — pasting a path back in does not get past it. Brand marks (YouTube, Telegram, Instagram, Facebook in the footer) stay inline on purpose: they are somebody else's trademark, not our icon language.

**One connective layer, two implementations.** The `dot / orbit / rail / connector` primitives ship as sprite symbols for fixed-size inline marks. A rail that has to span a responsive row is CSS instead — way21's seven-card day rhythm reflows 7 → 2 → 1 columns, and a fixed-`viewBox` SVG cannot follow that without stretching its dots. The CSS version keeps the same terms (1.5px dashed line, filled nodes, accent on `--cta`) and bleeds to the card edges so only the grid gap interrupts the run.

#### Network surfaces on the material

Depth is rebound rather than rewritten: `--shadow-soft` / `--shadow-med` in `network-tokens.css` now resolve to the material's shadows, which moves every card, panel and hover state in `landing.css` at once. The dark offer block takes `--cw-mat-inverse-bg`, and the sticky CTA takes the chrome tint, material filter and grain — the same surface as the platform topbar.

Card faces dropped their hairline and take the platform's treatment instead: material surface, no border, a resting soft shadow. Two things to know if this is ever revisited:

- **The hairline was the edge, not decoration.** These cards had no resting shadow at all — only a hover one — so removing the border without adding a shadow made them vanish into the canvas. Cream-on-cream needs one or the other.
- **No inset top highlight.** An earlier pass folded one into the depth token; it read as glossy shine rather than matte glass and was removed everywhere 2026-08-17 (see "Material on the network surfaces" above).

Note the pipeline asymmetry with the platform: landing CSS is served **raw**, not through lightningcss, so the hand-written `-webkit-backdrop-filter` lines there are harmless (they are fatal on the platform — see the two backdrop-filter rules above). Do not "fix" them by symmetry without checking which pipeline the file goes through.

Note for local checking: only `/way21` and `/reset-day` resolve to the static landings on `localhost`. `/consult`, `/herbs` and `/dosha-test` are **Next platform routes** there; the static versions are reachable only through their brand host (in a browser, map `*.centerway.net.ua` to `127.0.0.1`).

## Theming

- Public platform: single light theme in `:root`.
- Admin: dark theme via `.dark` class, toggled by `src/components/ThemeSwitcher.tsx` (mounted in `src/app/(platform)/admin/layout.tsx` only). Public surfaces have no dark mode; that is a decision, not a gap.
- `token_packs.json` defines full named theme families (`warm-mineral`, `living-mineral`, `natural-premium`). This is the designated mechanism for giving a future author/brand its own visual territory (one pack per brand, routing by surface) — roadmap stage 3.3. Do not invent a second theming mechanism.

## Coverage Boundary

The contract layer (`route_family_contracts.json` → `screen_manifests.json` → `block_manifests.json`) governs **generated funnel surfaces only**: consult/detox/herbs funnel-entry screens plus the pilot lesson — 5 screen manifests total. It does **not** govern `/programs/*`, `/products/*`, dosha, checkout, profile, or admin. Extending coverage is deliberately deferred until LMS (see meta-audit 2026-06-20, P0-D).

## Typography, Spacing, Geometry (stable invariants)

- Fonts: UI `Manrope`, editorial `Cormorant Garamond`, data `IBM Plex Mono`.
- Spacing scale `--cw-space-{2xs..3xl}` + `--cw-space-section-y`; container `--cw-max-width: 1160px`.
- Radii `--cw-radius-{sm,md,lg,pill}`; primary CTA shape `--cw-radius-btn: var(--ds-radius-button-soft)` (soft rounded rect — see `docs/archive/working-notes/platform-button-shape-contract-2026-05-14.md` if archived).
- Touch target minimum `--ds-touch-target-min: 3rem` (canonical since e0c7dbc).
- Breakpoints: mobile ≤ 560px, tablet 561–900px, desktop ≥ 901px.

## Validation Stack

`npm run ds:qa` = canon:guard → tokens:check → guard:ds-contract → guard:contrast → generator:validate → semantic:audit → lint → build.

| Gate | What it actually covers |
|---|---|
| `canon:guard` | canon files exist, preflight sentinels, raw-hex allowlist + no local `--cw-*` defs over platform CSS, manifest cross-references |
| `tokens:check` | codegen JSON→CSS is a no-op on a clean tree (drift gate) |
| `guard:ds-contract` | `--ds-*` delivery + landing token contracts, required `--cw-sem-*`/`--cw-platform-*` floor, cross-layer consumption bans, no `--cw-color-*` reintroduction, hero content parity |
| `guard:contrast` | WCAG contrast of rendered text/CTA pairs resolved from `cw.tokens.json`, both themes — platform light + admin dark (body ≥ 4.5, large/CTA fills ≥ 3.0). Since 2026-08-15 also composites the translucent material: 10 glass/inverse pairs checked against the worst backdrop each context allows |
| `generator:validate` + snapshot/determinism/language/rhythm | generator layer |
| `semantic:audit` | route-family contracts, block order, route invariants (alias redirects exist + redirect correctly) |

Contrast watch (`guard:contrast`): two light CTA fills sit in the large-text tier below body AA — `accent-contrast` on `guide-primary` (4.34) and on `boundary` (4.17). They pass at 3.0 as large/semibold labels but are the first candidates if the palette is retuned for a stricter bar. All `.cw-btn-primary` states and every dark admin text pair pass body AA.

### Orphan tokens (defined, no consumers)

Tracked so no one assumes they render:

- `--cw-role-*`, `--cw-cta-*` (in `token_packs.json`) — carried by packs for the dormant generated-app runtime; zero CSS consumers.
(none in the material layer — the shell and block migrations consumed it.)

Retired 2026-08-15, do not reintroduce: `--cw-component-glass-*`, `--cw-surface-glass-*`, `--cw-surface-shell-*`, `--cw-shell-frost-*`, `--cw-depth-*`, and the whole `layers.componentRecipes` branch. Their 49 consumers now read `--cw-mat-*`.

The absorption kept the axes apart rather than flattening them. Depth's *material* half became material proper (`card-bg` → `--cw-mat-surface`, the three shadows → `--cw-mat-shadow-{soft,raised,deep}`). Its *role* half stayed a role but is now expressed as the material shifted by a semantic hue (`--cw-mat-tone-{support,proof,boundary,icon}`), so those panels inherit a dark half instead of needing one invented for them.

**Cards are matte, not glass.** Glass belongs to chrome and to panels over media; a page full of `backdrop-filter` cards costs real frames and reads as decoration rather than as a specific effect.

**A control that sits on dark media inside a light page darkens, it does not lighten.** Hero chips and ghost buttons take `--cw-mat-inverse-control`. Reaching for a light tint there produced a pale pill carrying cream text — caught in review, and the reason this token exists rather than being improvised per component.

Note — `--cw-btn-primary-*` was previously listed here as orphan; that was wrong. `.cw-btn-primary` (globals.css) is a rendered class consumed by `RouteAuthGate` and the dosha test. Its fill was retuned 2026-07-06 (gray-accent mix → success/ink mix) because the old dark pairing was ~2.06; it now clears body AA in both themes and is asserted by `guard:contrast`.

## Aspirational Ledger (not implemented)

Kept out of the descriptive sections above on purpose:

- **7 brand modes** (`sanctuary`, `guide`, `method`, `proof`, `practice`, `progress`, `community`) — concept only; no token, attribute, or class carries them.
- **`organic` visual role** — named in old spec, no token exists.
- ~~`trust` as a first-class token~~ — resolved 2026-07-03: `--cw-sem-trust: #35535f` exists in `layers.semanticAliases` (value carried over from the historic trust palette). Consumers migrate as they are touched.
- **Per-author theming in production** — mechanism exists (`token_packs.json`), zero consumers; activation is stage 3.3.
