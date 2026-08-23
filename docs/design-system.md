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

The generator emits `name: value` pairs only — **comments cannot round-trip through it**. Notes that used to live inside a marker block belong here instead. Carried over 2026-08-15: the wordmark carries the identity's "CenterWay" + MOVE · BALANCE · GROW tagline; wordmark aspect is 541.3:129.3 ≈ 4.19 — keep `--cw-brand-size-wordmark-*-width/height` in that ratio.

### The mark (F2, 2026-08-20)

The figure emblem is gone. The mark is **F2**: one continuous brush spiral — 2.75 counter-clockwise turns, three arcs with 48° gaps, each tucking back toward the core, weight rising over the first tenth of an arc and tapering to nothing over the last forty percent. `viewBox 0 0 64 64`.

Geometry has **one source**: `data/brand/cw-mark-f2.json`, lifted from the approved `LogoMark` in the Claude Design system. `npm run brand:build` bakes it into every shipped file; `npm run brand:check` (wired into `ds:qa`) fails if any of them drifts. Never hand-edit the baked output.

| Output | Consumer |
| --- | --- |
| `public/cw/brand/cw-mark.svg` | platform header + footer, as a **CSS mask** |
| `public/cw/brand/cw-mark-compact.svg` | the 20–24px build (two arcs, 86° gaps, floored weight) |
| `public/cw/brand/cw-mark-{ink,gold}.svg`, mirrored into `shared/img/` | `<img>` consumers — the landing navs and footers |
| `src/app/icon.svg`, mirrored into `shared/img/cw-icon-tab.svg` | the tab icon — one file for the platform and all eight landings, theme-adaptive |
| `src/app/favicon.ico` | raster fallback for browsers without SVG favicons |
| `src/app/apple-icon.png`, mirrored into `shared/img/cw-apple-touch.png` | iOS home screen, 180px |
| `public/cw/brand/cw-icon-{192,512}.png`, `cw-icon-maskable-512.png` | installed app, via `src/app/manifest.ts` |
| `public/cw/brand/cw-og-cover.png`, mirrored into `shared/img/` | link previews, 1200×630 |
| `src/components/brand/markGeometry.ts` | `LogoMark`, the animated states |

#### One fit table, and why the old numbers lied (2026-08-21)

The mark does not fill its viewBox and is not centred in it: the full build's ink runs 7.03–52.95 across and 8.43–57.27 down a 64 square. So it covers **76%** of the box and sits up and to the left of the middle. Every icon used to be made by scaling the viewBox, which meant a stated `inset` was multiplied by that 76% before it reached the tile — `inset: 0.9` shipped a mark covering 69%, `inset: 0.72` shipped one covering **48%**. That is why the favicon read as a speck in Vercel's project list next to real app icons.

The ink box is now recorded in the geometry file (`full.box` / `compact.box`) and every tile is *fitted* to it — scaled by the longer side, centred on the ink, not on the square. `fit` is therefore the honest number: the fraction of the tile the mark covers. The bake re-measures the box against a render each run and fails if the geometry moved without it, so the compensation cannot go stale the way the old hand-measured 10.75% padding in `network-tokens.css` did.

| tile | `fit` | bounded by |
| --- | --- | --- |
| `launcher` — dock, taskbar, installed PWA, `purpose: any` | 0.78 | nothing crops it |
| `maskable` | 0.62 | Android's 80% safe zone, with room for a circle |
| `touch` — iOS home screen | 0.72 | the OS rounds the corners itself |
| `tab` — favicon, address bar, search suggestions | 0.78 | nothing crops it |

These only mean anything next to each other. An app icon and a favicon that disagree read as two different products, which is what 69%-vs-48% was.

#### The tab icon flips with the viewer's colour scheme (2026-08-21)

A fixed pairing cannot win both surfaces, and we had already proved one half of it. Ink on cream measures 12.09 and still vanished in a light tab strip, because at 16px the contrast that matters is the **tile against the browser's own chrome**. Swapping to a dark tile fixed the light strip and lost the other one — on Vercel's dark dashboard the deep tile disappeared into the row it sat in.

So `icon.svg` carries a `prefers-color-scheme` rule: deep tile + gold mark on a light UI (6.92), cream tile + ink mark on a dark one (12.09). Gold on cream is never the pair — that is 1.75. `favicon.ico` cannot flip, so it ships the light-UI pairing; the browsers that need it are the ones least likely to be running dark chrome.

**The tile stays.** A bare transparent glyph is the other way to solve this, but the mark is a thin open spiral: at 16px on a busy toolbar it reads as a smudge where a tile reads as an icon. That matters most exactly where the favicon sits inline with text — the address bar and the search suggestion list.

**App icons cannot flip.** A manifest icon is a PNG and there is one of it, so the launcher tile stays ink on cream: a light tile has its own edge on a dark dock and holds against a light one. Adaptivity in the app itself is a separate mechanism and already works — `cw-mark.svg` is consumed as a CSS mask, so the in-app tone is a `background-color`.

`favicon.ico` wraps a PNG payload, and that PNG has to be **RGBA** — Next's ICO decoder rejects RGB, which is why `rasterise` calls `ensureAlpha()` after flattening. The webpack production build tolerates it; the dev server does not, so a bad one only shows up when you actually run the app.

`manifest.ts` lives at the **app root**, not inside a route group — Next does not pick up a manifest from `app/(platform)/`. Two icon purposes ship on purpose: `any` fills the square because desktop launchers draw the file as given, `maskable` keeps the mark inside the 80% safe zone Android's launcher shapes will not crop.

The OG card is gold on the deep ground rather than ink on cream: a preview renders inside someone else's chat or feed, and the dark card holds its edges against both light and dark hosts. The wordmark goes in as the outlined paths `cw-wordmark-light.svg` already carries, so the bake needs no font and cannot come out different on another machine. `getLandingMetadata` uses it as the **floor** — a landing with its own hero shot (way21, reset-day) still overrides it.

**Masked, not filtered.** The header used to flip one PNG between tones with `brightness(0)`, which can only produce black — so the light tone got a black mark instead of the header ink. `--cw-brand-asset-logo-symbol-header` is now a mask source and `--platform-header-symbol-color` names the fill per tone: header ink at 96% on light, `--cw-platform-accent` on dark.

**Both tones share a viewBox**, so `--cw-net-brand-mark-gold-inset` is gone. It existed only because the two old PNGs were cropped differently (256px inset to 78.5% versus 128px edge to edge) and the gold one read ~27% larger in the same box. Baked marks cannot drift apart that way, so there is nothing left to compensate.

**Motion** — `LogoMark` (`src/components/brand/LogoMark.tsx`), three states, none of which rotate. A spinning spiral reads as a system spinner and stops being the brand.

| `animate` | Shape | Where |
| --- | --- | --- |
| `draw` | written from the core outward, 2.4s, one pass, stays | app load, first open of a page (cabinet) |
| `breath` | turns expand and contract, outer further than inner, 3.6s loop | empty states, practice screen, background presence |
| `wait` | turns gain density in turn, form stands still, 2.1s loop, 0.26s stagger | the spinner replacement — LMS course/lesson loading |

`draw` cannot run the outlines themselves: a variable-width outline has no single dash direction. It strokes the `mids` centrelines at width 9 inside a mask and wipes the filled arcs in behind it. `prefers-reduced-motion` gets the finished mark, not a slower animation.

**The burger is a sprite glyph, `menu`, not CSS rules** — three strokes through the same `icons-bake` hand as every other icon, which is the whole reason it is a glyph and not three divs.

**It carried a fourth element — a core under the three rules — from the mark's grammar, and that was reverted on 2026-08-20.** The reasoning had been that the one control every page shows should echo the mark; in place it read as one thing too many two inches under the mark itself. `menu-core` is retired: platform and all eight static landings render `menu`.

Rendered at **32**, not the set's usual 24, so it reads at the mark's scale: the rules span 16 of 24 units, which at 32 draws 21px against the mark's 25px, and the 1.5 stroke lands at 2px against the brush's ~2.2px. Every burger in the network is this glyph — `.menuButton` (platform), `.cwn__toggle` (network nav), `.cw-nav__burger` (the older short/irem nav) — each stacking `menu` and `close` in one grid cell and crossfading.

### Utility controls carry no label (2026-08-20)

A control whose whole job is obvious from its glyph does **not** get a word next to it. Close, previous, next: the icon says it, and the word repeats it. The accessible name moves to `aria-label`, so nothing is lost for screen readers — only the visual load goes.

This is about redundancy, not about stripping text. A label that names a **destination or a panel** stays: the lesson bar keeps `← До курсу` and `☰ Зміст`, because the arrow says "back" but only the word says *back to what*, and the glyph says "list" but only the word says *which list*. Two bare icons there would be a guessing game, not restraint.

Applied: the contents drawer's close button (was the word "Закрити", with no accessible name at all); the lesson pager, which stacked a direction word over the lesson title in each cell and is now one row of arrow + title.

Literal characters — `×`, `✕`, `✓`, `&times;` — are not icons. They render in whatever weight the system font supplies and never match the baked set. Every one of them is now a sprite glyph: the contents drawer's lock and check marks, the auth modal's close, and the nav and lead-modal closes on irem, short, short-b and way21. The `font-size` hacks that existed only to size those characters went with them.

### One text column, and cards behind it (2026-08-20)

Running text starts on **one** left edge. The lesson player had three: paragraphs flush, the objective indented behind a gold rule, and `ul`/`ol` padded in by 1.2rem — with `display: grid` on the list, which blockifies the items and drops their `::marker`, so that indent held nothing at all. List markers now **hang in the margin** (accent dot for `ul`, a data-font counter for `ol`) and the text lands on the paragraph edge.

Cards keep their own inset — that is a change of register, not a stray indent — but they lost their 1px outline. A surface and its padding already separate a card from the paragraph above it; the rule on top of that was what made running text hitting a card read as a jump. (It was also `--cw-border`, an admin-tier token: all ten uses in the LMS module moved to `--cw-platform-border`.)

**One abstract under a title, never two.** Every way21 lesson carries a `summary` and a `lesson_objective` that paraphrase each other — "Задача етапу — увійти в процес та підготувати органи" against "Увійти в процес і підготувати органи". Stacked, and with the objective wearing a gold rule, they read as a choice the page failed to make. The objective wins and renders flush at lead weight; the summary only appears on lessons that have no objective. Lesson summaries now have no other consumer in the UI — decide whether they belong on the drawer row before authoring more of them.

### Progress is a dashed rail, not a filled bar (2026-08-20)

`ProgressRail` (`src/components/platform/ProgressRail.tsx`) draws **one dash per lesson**: completed in accent, remaining in `--cw-platform-border`. A filled bar answers "roughly how far", which for an 11-lesson protocol is less than the reader wants; dashes answer "how many, and how many left", and they are the same dash language the icon graphics and the landing rails already speak.

Each dash takes a small tilt and length variance from a **seeded** function of its index — same principle as the icon bake, never `Math.random`, so the rail is identical on the server, on the client, and on every visit. Above 32 dashes it falls back to a repeating gradient: the per-dash hand is lost, but a 90-dash rail was never countable.

In use on the course page and both cabinet course meters. The dosha score bars stay solid — they are proportions of a whole, not countable steps.

### Utility chrome is transparent at rest (2026-08-20)

`.iconButton` and everything that composes it (`backButton`, `iconButtonBare`) render with no background and no shadow until hover or focus. They are chrome sitting on their own row with nothing to separate from; two filled pills there read as objects competing with the lesson.

### Cabinet tabs, card actions, one container (2026-08-20)

**Tabs mark, they do not fill.** Five filled chips in a row is five objects competing before the reader has chosen anything, and the active one — `--cw-platform-text` as a background — read as a button not yet pressed. Active became the foreground at full weight plus a 2px underline, the same call the platform header made and for the same reason. *(The cabinet's own tab strip was replaced by `CabinetFold` on 2026-08-22 and its CSS deleted on 2026-08-23; the rule survives it — see "One nav-state contract" below, which is where the marker now lives for every surface that draws one.)*

**Card actions: one row when they fit, full width when they do not.** `flex-wrap` sized each button to its own label, so two buttons came out two different widths and neither reached the card edge — stubs floating in a card rather than its footer. The threshold is the button contract's own `--ds-button-min-width`, never a breakpoint: `.actions > * { flex: 1 1 var(--ds-button-min-width) }` grows a pair to share a line when both clear the minimum and wraps each to a full-width line of its own when they do not. A `min-width: 48rem` override used to set `flex-grow: 0` here and was removed on 2026-08-23 — it left a 326px card showing two 168px buttons with 158px of dead space beside each, which is neither of the two states this rule exists to produce.

**One container per control.** The lesson's completion bar was a raised surface card whose only child was a filled pill: two shadows, two radii and two paddings for one checkbox. `.completionBar` now carries stickiness and reach only, and `.completeToggle` composes it — the control *is* the bar. The reference-page variant is gone entirely: it floated a card holding a hint and a second "До курсу" over a pager that already offers the course map one scroll below.

**List gap 0.7rem, not 0.4rem.** Lesson list items are "term — definition" and most wrap to two or three lines at 1.6 line-height; at 0.4rem the space between items was smaller than the space between two lines of the same item, so the list read as one paragraph with bold words scattered through it.

### The detail hero's title has a base, not just breakpoints (2026-08-22)

`.detailHeroTitle` (program, product and diagnostic offer heroes) had **no base
rule inside the bundle its component loads**: the only declarations lived in
`PlatformBlocksOffer.module.css`, which `PlatformHeroStyles` does not merge. So
the element took the per-breakpoint `font-size` overrides on top of the
browser's `h1` defaults — `line-height: 1.5`, no measure. A 57-character
program name came out five lines at 86px and pushed the hero 240px past the
fold on a 1440x900 screen.

The base now lives in `PlatformBlocksOrientation.module.css` beside its
siblings: UI face, weight 800, `--ds-type-hero-line-height`, measure 15ch,
`text-wrap: balance`, and the same on-photo shadow `.heroFeatureTitle` carries.
**Sentence case, not the home hero's uppercase 900** — these titles are whole
sentences, and the plate treatment belongs to a two-word title. The breakpoint
scale was retuned with them (desktop `clamp(2.9rem, 3.9vw, 4.4rem)` at 17ch,
down from `clamp(4.1rem, 6vw, 6.3rem)` at 9.5ch), and the tablet band's copy
column got a real start gutter — it was `margin-inline: 0 auto`, which put the
badge and title hard against the bezel.

The general rule: a class that only ever appears inside `@media` blocks is a
class with no base. If the merged bundle does not carry its unconditional rule,
the browser's defaults are the base, and they will not match anything.

### A list is text, not a stack of cards (2026-08-22)

`.timeline` (`PlatformBlocksBase.module.css`) is the platform's **one** plain
list, and it now follows the lesson player's rule from 2026-08-20 rather than
contradicting it: gap 0.7rem, marker hanging in the margin (accent dot at
`left: -0.85rem`, `top: 0.62em` so it lands on the x-height), text on the
panel's own left edge.

It used to give every `li` a soft-rect plate — `--cw-platform-surface` plus
`--cw-mat-shadow-soft` plus 0.9rem padding. A five-line list inside a panel
therefore rendered as **six surfaces to say five short sentences**, and the
plates read as pressable when nothing in them is. The offer page showed the
failure twice side by side: results as five plates in the left panel, format
facts as three more in the right, where those were a `<div>` of `<span>`s
(`.programFormatMeta`) carrying a second, slightly different plate recipe.

Fixed in three places, because the plate had been re-asserted after the base
rule: the format facts are now a real `<ul class="timeline">` (`.programMetaList`
sets only its top step and small type), and two responsive blocks that re-added
`padding: 0.85rem` to `.timeline li` below 900px and to `.profileMain .timeline
li` are gone. Surfaces that are genuinely objects — `.outlineItem`, course
cards, offer tiles — keep theirs; the test is whether the row does something
when you touch it.

## Buttons — the one contract (2026-08-21)

Source: `src/components/platform/PlatformButtons.module.css`. Gate: `guard:buttons`.

The same button had been written five times — platform shell, hero, cabinet, LMS, offer tiles — and the copies drifted on **every axis that was not a token**: label weight came out 600 / 700 / 800, the gold ramp was duplicated verbatim in three files and flattened to a solid fill in two others, inline padding took four values (`--ds-button-padding-inline`, `--cw-space-md`, `--cw-space-lg`, `2em`). Height was 3rem everywhere but expressed through **two different tokens** that merely happened to be equal, so the next edit to either would have split them. Radius was the only axis that held — because it was a token from the start.

That is the rule this section encodes: **an axis with no token is an axis that will diverge**, and a document alone does not stop it. Hence a contract file that owns the recipe, tokens for every axis, and a gate that fails the build when a component stylesheet reaches for one.

### `composes` does not chain — name `base` explicitly (2026-08-21)

`.chromeBare` composed `chrome`, and `chrome` composes `base`. That transitive
chain **does not survive the bundler**: the class list that reaches the DOM is
`chromeBare chrome`, with `base` missing. Everything `base` owns therefore did
not apply — geometry, `display: inline-flex`, the focus ring.

Measured on the builder before the fix: the header's previous/next arrows came
out **48×20** and the row menus **48×18**, against a 48px touch minimum, with
`display` falling back to `block`. Nothing failed loudly; `guard:buttons` reads
the stylesheet, not the rendered box, so a role that composes correctly on paper
passes while shipping a 20px control. The learner's own `iconButtonBare` was on
the same chain.

`.chromeBare` now names both — `composes: base; composes: chrome;`. **A role
that composes another role must name `base` itself.** One-level composition is
what actually arrives, so it is what we write.

### Six roles, and there is no seventh

| role | where | fill | stroke | elevation |
|---|---|---|---|---|
| `primary` | the one action that advances money or progress — **max one per view** | gold ramp `accent → accent-pressed` | — | gold-tinted, lifts on hover |
| `secondary` | an alternative of the same weight, standing on the page canvas | `--cw-platform-surface` | — | `--cw-mat-shadow-soft` → `raised` |
| `quiet` | a tertiary action **inside** a card or on sunk ground | `--cw-mat-surface-sunk` | `--cw-mat-stroke-control` | none |
| `chrome` | nav/utility on its own row — back, pager, drawer close | transparent at rest | — | arrives on hover/focus |
| `onMedia` | a control over hero photography | night glass at the chrome floor | `--cw-mat-stroke` | `raised` |
| `text` | an underlined text control — no plate, still a full touch target | transparent | — | none |

`quiet` carries a stroke and `secondary` does not, and that is not decoration: a soft fill on a soft surface is not a control. The cabinet's sunk buttons measured **1.08** against the card behind them — readable label, no button. See "The control stroke".

`onMedia` is the night glass, not the media tint: on the day surface it was the one light plate on the page and read as a *disabled* control beside the gold CTA.

**One action per card gets `primary`.** Two gold buttons side by side is two answers to "what do I do here".

### The axes, and where each lives

| axis | token | value |
|---|---|---|
| height | `--ds-button-min-height` | → `--ds-touch-target-min` (3rem). **One number, one name.** |
| inline padding | `--ds-button-padding-inline` | 1.15rem |
| corner | `--ds-button-radius` | → `--cw-radius-btn` → `--cw-radius-md` (16px) |
| label weight | `--ds-button-font-weight` | **700** |
| label size | `--ds-button-font-size` | 1rem (`text` overrides to the small body size) |
| icon gap | `--ds-button-gap` | 0.5rem |
| hover lift | `--ds-button-lift` | −1px (`:active` inverts it) |
| standalone width | `--ds-button-min-width` | 10.5rem — **opt-in via `wide`** |
| ceiling | `--ds-button-max-width` | 22rem (352px) — **always on, no opt-out** |

Colour is deliberately *not* in this table. `--ds-*` is the delivery alias layer; fills come from `--cw-platform-*` / `--cw-mat-*` inside the contract file. A program tile paints its own theme and therefore composes `base` rather than `primary` — a themed control still owes the system its size, weight and corner.

`wide` is opt-in because card actions are full width instead (see "Card actions are full width"); a min-width inside a card fights the grid.

The ceiling is the other half of that rule, and it is **not** opt-in (2026-08-21). "Card actions are full width" was written when a card was a card; it stopped being true once the card could be the width of a maximised window — the cabinet's "Вийти" came out a metre-long plate, and the LMS course CTA the same. So `width: 100%` still means "fill your footer, do not float in it", and the contract caps what filling can mean. 22rem is above every phone's content width (343px at 375px), so the mobile full-width button is untouched; the cap only bites where the container got wider than a hand. A capped button sits at the start of its cell, which is where the card's own text starts.

### What the gate enforces

`guard:buttons` fails when a stylesheet other than the contract declares `min-height`, `padding-inline`, `border-radius`, `font-weight`, `font-size`, `min-width` or `max-width` on a button-named selector without the matching token — or repeats the gold ramp. Layout (`width`, `justify-self`, grid placement) and locally themed colour stay the component's business.

Three things are named exemptions in the guard, each with its reason in the source: `.completeToggle` is a checkbox, not a button; `.menuButton` is utility chrome with its own square-ish radius; and a handful of containers (`*Actions`, `videoActionCard`) match the name pattern without being controls. An exemption is a statement, one grep from review — not a silencer.

### The network is on the contract too (2026-08-21)

The five landings paint from their own `--cw-net-*` skin and cannot compose a CSS Module, so the contract reaches them **as tokens**. `cw-tokens.generated.css` now carries the button geometry alongside the palette and material — `--cw-radius-md/btn`, `--ds-touch-target-min`, the `--ds-button-*` set — listed explicitly in the generator (`NETWORK_BUTTON_TOKENS`) rather than by prefix, so widening a scale does not silently enlarge the network payload. `network-tokens.css` binds them to short `--btn-*` aliases and `--r-btn` now *resolves from* `--ds-button-radius` instead of restating 1rem.

What that closed:

| | was | now |
|---|---|---|
| `.btn` height | **none** — padding-driven `1.05em 2em` | `min-height: var(--btn-h)` (3rem) |
| `.btn` label | 1.02rem, overridden to 1.05rem in `.offer` and 1rem in `.fc-cta` | one size, no overrides |
| `.btn` lift | −2px | `var(--btn-lift)` (−1px) |
| `.btn-primary` | flat `--cta`, hover shadow hardcoded `rgba(219,165,79,.36)` | the gold ramp, shadow mixed off the skin's own gold |
| `.btn-ghost` | 1.5px `--line-strong`, hover swapping border + text + background to the route green | the contract's `quiet`: sunk fill + `--cw-mat-stroke-control` |
| `.cw-btn` (generator runtime) | `3.35rem` tall, **`border-radius: 999px`** — a pill — gradient at 180° | contract axes, soft rect, 135° |
| utility pages (`pages.css`) | own 0.75rem corner, own padding | contract axes as fallbacks |
| touch target | `2.75rem` in `tokens.css`, `44px` in two bridge fallbacks | 3rem everywhere — the canonical value |
| `--landing-radius-cta-control` | 1rem (way21) vs **1.05rem** (reset-day) | `var(--r-btn)` |

**`quiet`, not `secondary`, is the network's second action** — and that was settled by measuring, not by taste. `secondary` is a surface plate, which reads on the platform because its canvas and its surface are different colours. On a landing they are the same: the plate measured **1.09** against the ground behind it, which is the documented 1.08 failure over again. So the second action keeps a drawn boundary, now the control stroke rather than an arbitrary 1.5px line — measured in place at **3.37** against the canvas and **3.10** against its own fill, both past WCAG 1.4.11's 3:1, with the label at 8.70.

The lesson generalises: **`secondary` is only available where the canvas and the surface differ.** Everywhere else the tertiary role is `quiet`, and the stroke is not decoration.

The pill is the one worth naming: the doc had said "soft rect everywhere, never pill" since the type-and-shape migration, and a live generator surface had been running a 999px CTA the whole time. A rule nothing checks is a rule that is already broken somewhere.

Fallbacks are expected in these sheets — `funnel-network.css` and `pages.css` are self-contained by design — so `guard:buttons` also asserts that **every fallback agrees with the token it stands in for**. A fallback that disagrees renders correctly in dev and wrong behind a stale cache.

**Still not covered:** Short and IREM. Different authors, isolated themes — a separate product surface, not this system's coverage. They share `pages.css` and `tokens.css`, so the touch-target correction reaches them; nothing else does.

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
| `--cw-mat-*` | **material** (tactile surface layer; light + dark halves) | `cw.tokens.json` → `layers.material.{light,dark}` (codegen-owned: `CW_RUNTIME_TOKENS` / `CW_MATERIAL_DARK`) | `[data-cw-material]` recipe in `globals.css`; platform shell (topbar, mobile menu, profile card, hero controls) | guard:contrast (glass pairs), canon:guard |
| `--cw-platform-*` dark half | public dark palette | `cw.tokens.json` → `layers.modeOverrides.platformDark` (codegen-owned: `CW_PLATFORM_DARK`) | `[data-cw-theme="dark"]` — authored, no switch wired | guard:contrast (`platform-dark` theme) |
| `--ds-*` | delivery alias | `cw.tokens.json` → `delivery.dsAlias` (full contract incl. type/button/offer-card scales; codegen-owned since 2026-07-03) | platform + landing bridge | guard:ds-contract (required-token list), tokens:check |
| `--cw-sem-*` pack override | program/author pack | `cw.tokens.json` → `layers.packs.mineral` (codegen-owned: `CW_PACK_MINERAL`) | `.cw-pack-mineral` scopes | canon:guard (hex allowlist) |
| `--cw-role-*`, `--cw-cta-*` | generator theme packs | `token_packs.json` | **none yet** — wired into `themeCatalog.ts`, zero CSS consumers; designated per-author theming mechanism, activation deferred until a second real theme exists | generator:validate |
| `--cw-net-*` | platform-author network skin | `shared/css/network-tokens.css` — **references** `--cw-sem-*` / `--cw-mat-*`, no longer copies their values | the five landings | tokens:check (drift of the generated source) |
| `--landing-*`, `--product-*`, irem `--color-*` | isolated landing themes | `src/landing-static/**` (hand-maintained) | Short/IREM landings only | guard:ds-contract (cross-layer consumption bans) |

Removed layers: `--cw-color-*` (legacy DS bridge, `appAlias`) was deleted 2026-07-03 — it had zero component consumers. Do not reintroduce the prefix.

### Palette (gamma chosen 2026-08-20)

The default gamma is the **brand sheet**: warm orange over deep green, cream ground. It replaced the mineral gamma that had been the default until 2026-08-20; mineral did not go away, it became a pack (below). Both cleared `guard:contrast` in full before the swap, so the choice was aesthetic, not accessibility-driven.

| Role | Value | Note |
|---|---|---|
| `calm-bg` / `calm-surface` / `calm-surface-muted` | `#faefe0` / `#fff8ef` / `#f3e4d0` | cream ground instead of white |
| `method-ink`, `guide-strong` | `#203126` | deep green — headings, strong fills |
| `guide-primary` | `#456b58` | muted green, the route voice. The brand sheet's own `#588768` was too bright as a fill and sat at 3.64 against the CTA label; deepening it clears body AA at 5.29 |
| `embodied` | `#7a9b78` | the living green — practice marks, progress. Split off `guide` on 2026-08-20: the brand sheet had both roles on one value, so two roles spoke with one voice |
| `trust` | `#4a6577` | soft slate blue. The only cool tone in the system, and deliberately **not** a button colour — it carries proof panels, badges, curator links |
| `warmth` / `warmth-strong` | `#e5ae65` / `#c8913f` | gold and deep gold; the CTA gradient runs between them |
| `progress` | `#edc693` | light gold |
| `boundary` | `#b76045` | terracotta — the one value both gammas share |
| `muted-ink` | `#48544c` | body ink on light grounds. A mix off `platform-text` lands at 4.19 on cream, below body AA — hence a token, not a formula |
| `platform-text` | `#18261d` | one step deeper than `method-ink`: at `#203126` the topbar label on chrome glass falls to 4.00 at the tone bound |
| `platform-accent-contrast` | `#fff8ef` | label on fills. `#faefe0` reads 4.44 on the dark-tone chrome glass, just under the bar |

**The landing network moved with the platform.** All five skins (`way21`, `reset-day`, `dosha`, `consult`, `herbs`) were repainted into the brand family on 2026-08-20, keeping the axis they already varied on — way21/dosha deepest (`#3f6350`), consult brighter (`#456b58`), reset-day lighter and warmer (`#55806a` on a `#fdf6ec` canvas), herbs the leaf green (`#56804f`). Soft tints are derived, not hand-picked: `route` mixed into the cream surface at 6/8/12% for chip-soft/soft/chip, and into the canvas at 18/30% for the two hairlines — a green tint over a cream ground goes khaki fast, so the mixes stay low. The night side (`--irem-dark-1/2`, `--cw-net-hero-scrim`) now matches the platform's inverse gradient. Every literal the contrast gate asserted moved with them; `guard:contrast` covers the network at the same bar as before.

Admin dark (`base.dark`) stays neutral grey — the brand sheet's green admin shell was not adopted, and its own rule ("never green on a dark ground") argues against it.

**Packs.** `layers.packs` re-points the same `--cw-sem-*` role names for a scope; because only values move and never names, no component changes. This is the mechanism the dormant `token_packs.json` was always meant to prove.

Four packs today, all generated into `globals.css` from the JSON:

| Pack | Gamma | Opt-in |
|---|---|---|
| `mineral` | the warm-mineral gamma (`#f6f2ea` / `#31403e` / `#4f7e76` / `#c1906b`) — individual programs and author landings | `class="cw-pack-mineral"` **or** `data-cw-pack="mineral"` |
| `way21` | the deep green way21 and dosha share (`#3f6350` route, `#1f2e24` ink) | `data-cw-pack="way21"` |
| `reset-day` | lighter and warmer, on its own `#fdf6ec` canvas (`#517a65` route) | `data-cw-pack="reset-day"` |
| `herbs` | the leaf green (`#537c4c` route, `#283b2b` ink) | `data-cw-pack="herbs"` |

The three added 2026-08-21 exist so a **course** can pick its look (`src/lms-core/theme.ts` — the choice is a name from a closed list, never a value an author types). Their greens are the landings' own, deepened where a course needed them to clear body AA on the reading surface — reset-day `#55806a` → `#517a65` (4.61), herbs `#56804f` → `#537c4c` (4.58). That is the same move the brand sheet's `#588768` → `#456b58` made, and every pair is asserted in `guard:contrast`. There is deliberately no `dosha` or `consult` pack: dosha runs way21's green and consult runs the base one, and two names on one gamma is a control that does nothing.

**A pack re-emits the platform aliases.** `--cw-platform-bg: var(--cw-sem-calm-bg)` is declared on `:root`, and a custom property is substituted where it is *declared* — so a descendant that re-points `--cw-sem-calm-bg` inherits the alias already resolved against the root and nothing repaints. The generator therefore writes `layers.modeOverrides.platform` into every pack scope, before the pack's own values so a pack that pins a platform token of its own (mineral's ink) still wins.

**Two more course axes**, hand-maintained beside the generated packs and consumed by `Lms.module.css` / `Builder.module.css`: `[data-cw-course-font="ui"]` swaps the heading family for the sans the platform already loads, and `[data-cw-course-scale="compact"|"generous"]` moves `--cw-course-body-size`, `--cw-course-heading-scale` and `--cw-course-block-gap` together. Every consumer names a fallback that *is* the platform default, so a course that chose nothing renders exactly as it did before the axes existed.

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

Forbidden from components regardless of tier: `layers.primitives.*` (raw brand/mineral colors), raw hex, and any locally-defined `--cw-*` token (canon:guard enforces the last two on platform CSS). The rule of thumb: reach for the **highest** tier that already answers the need; drop a tier only when the one above doesn't expose the role.

## Block frame (2026-08-21)

Every content block on the platform is `PlatformBlock`: **head + body, and no surface of its own.**

```
<PlatformBlock id label title lead graphic?>  →  <section class="container section blockFlow">
                                                   <header class="blockHead"> label / title / lead
                                                   {body}
```

- **`label`** is the eyebrow — which part of the journey this is. **`title`** is the block. **`lead`** is one sentence, ideally the question the block answers (the `journeySteps` wording in `content.ts` is written for exactly this).
- **The frame never draws a panel.** Cards, rails and media inside the body carry their own material. This is the rule that removes the triple container: the herb block used to be `section → article.panel → div.panelStack → div.panelIntro → h2`, so a grid of surfaces sat inside a surface inside a surface.
- **`graphic`** paints `--cw-sem-texture-arcs` / `--cw-sem-texture-rings` behind the head at 0.16 (0.12 on a phone). These are **derived from the mark's grammar — concentric arcs — not the mark itself**: the logo behind a heading reads as a watermark on a document, while its geometry reads as paper. It belongs to the block, so three notes do not become three decorated objects.
- The block clips (`overflow: clip`, never `hidden`): the texture is bled past the right edge, and unclipped it widened the document — which on a phone gives the whole page a horizontal scroll and unsettles the fixed topbar. `hidden` would also fix the width, but it makes the element a scroll container and that breaks `position: sticky` inside it.
- Text notes inside a block carry **a glyph in a toned slot** (`--cw-mat-tone-icon`), not just a sentence: three plates in a column read as a wall of paragraphs, and the icon is what separates them before a word is read.

Before this, blocks were assembled three different ways on one page — a bare `h2` and a grid; an `h2` inside a flex row beside an empty `div`; and the panel-in-panel stack above. On a phone that reads as the page changing its mind every screen.

## Material layer (tactile surfaces)

Added 2026-08-15 as the first step of the tactile redesign (research: `docs/archive/working-notes/ds-tactile-redesign-research-2026-08-15.md`). One glass, not a ladder of them — the decision was explicitly "одно среднее стекло", warm and grainy.

| Variant (`data-cw-material`) | Material | Where |
|---|---|---|
| `matte` | opaque warm ground (`--cw-mat-surface`), no blur | reading surfaces, forms, dense text |
| `glass` | tint 76% + `blur(34px) saturate(1.18)` | cards, chips — anything over the page canvas |
| `glass-media` | tint 86%, raised shadow | panels sitting over a photo |
| chrome tint 55% | the same glass, far more transparent, **no stroke** | the topbar — see below |
| `inverse` | dark mineral gradient `#182a20 → #2c4635` (165deg) | offer blocks — the night side of the same material |
| tones | the material shifted by a semantic hue: `--cw-mat-tone-{support,proof,boundary,icon}` | role-tinted panels, icon slots, boundary notes |
| inverse controls | `--cw-mat-inverse-control` — a darkening scrim | chips and ghost buttons sitting **on** dark media inside a light page |

Shared by all: 1px light stroke, two-part shadow, and an SVG grain that is what makes the surface read as matte rather than plastic. There is deliberately no inset top highlight — an earlier pass (`--cw-mat-highlight`, an `inset 0 1px 0` white line) read as glossy shine rather than matte glass and was removed network-wide 2026-08-17; see the note under "Material on the network surfaces".

The grain is **one token, `--cw-mat-grain-image`, carrying its own strength** (alpha baked into the SVG: 0.05 light, 0.16 dark). It is applied with a single `background-image` declaration and nothing else. This is deliberate: an earlier split into image + `opacity` + `mix-blend-mode` meant a surface that set only the image got the grain at full strength — which turned the topbar into grey sandpaper (measured: `#f6f2ea` page vs `#d1cdc6` bar). One declaration cannot be half-applied.

**Why two glass tints and not one.** Glass has no fixed background, so contrast must hold against the worst backdrop the context allows, and there are two contexts. Over the canvas the backdrop is always the warm page, so 76% carries body *and* muted text. Over a photo the backdrop can be anything a photograph contains — measured against black, body ink still clears AA at 11.83, but the muted label only reaches 3.83. Hence the rule and the second tint:

- muted/secondary text on `glass-media` must be **large/semibold** (WCAG large tier, the same treatment CTA fills already get);
- `--cw-mat-tint-floor` (76%) and `--cw-mat-tint-media-floor` (86%) are tokens precisely so `guard:contrast` can assert them. Lowering either fails the gate — verified by regression test.

### The hero scrim's ink is neutral (2026-08-20)

The photo hero darkens with `--cw-mat-scrim-ink` (`#171817`), not with `--cw-platform-text`. The old ink was `#18261d` — a green-black — and the ramp runs to 82% on mobile and 84% on desktop. At that strength a green-black does not darken a photograph, it repaints it. Turning the scrim off is the proof: the platform's hero image is warm — brown wood, warm light — and every part of the green cast was coming from the scrim.

The opacities did not change (they are what the copy's contrast is asserted against in `guard:contrast`); only the hue did. The brand-tint layer beneath it dropped from 9% to 5%, since seating the image in the palette and darkening it are two jobs and the ramp was doing both.

The landing network still scrims with `--cw-net-hero-scrim` (`#182a20`) at up to 92% — the same green-black, deliberately left for now because there the scrim also serves as the brand band under the copy.

### Meters are one recipe (2026-08-21)

Every bar the platform draws — the dosha scores in the cabinet, the diagnostic progress row — uses `--cw-mat-meter-track` and a `guide-primary → guide-strong` fill. The gradient's two ends are asserted against the track in `guard:contrast` (4.92 / 11.26 against a 3:1 bar for a graphic that carries meaning).

The original diagnostic ramp was `status-success → status-pending` and measured **2.75 / 2.65** against the same track: under the bar, and the reason the identical recipe read as a grey hairline once it was reused. Status colours are for status; a meter is not one.

### The control stroke (2026-08-20)

The material is all soft edges, and a control that is only a soft fill on a soft surface is not a control. The cabinet's secondary buttons were `--cw-mat-surface-sunk` on a card: measured **1.08** against the card behind them. The label was perfectly readable; the button was not there.

`--cw-mat-stroke-control` is the one token in the layer built for a drawn boundary — translucent ink in light, translucent cream in dark — and it is the only stroke held to a contrast bar. WCAG 1.4.11 puts a UI boundary at 3:1, so `guard:contrast` asserts it composited over **both** surfaces it is drawn on (card material and page ground) in **both** themes: 3.38 / 3.34 / 3.38 / 3.71. Thin the mix and the gate fails instead of the control quietly going flat again.

It is not decoration and not a divider — `--cw-mat-stroke` (the light top edge) and `--cw-mat-stroke-inner` (the hairline that divides one surface) keep those jobs and stay unmeasured, because neither claims to be a boundary you can press.

**What it is deliberately not used for: state.** An outlined chip was tried for the cabinet's active tab and removed the same day — the strip sits straight on the page ground, so outlining the chosen tab turned a quiet row into five objects. "You are here" stays the foreground at full weight plus the marker.

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

### The profile is on the recipe, not beside it (2026-08-20)

The user cabinet (`/profile`) was the last platform surface carrying a **private component set** instead of consuming `[data-cw-material]`. It rendered as two design systems stitched at the fold, and the split was structural rather than cosmetic:

| | Above the fold | Below the fold |
|---|---|---|
| surface | hand-rolled: `--cw-mat-tint` + grain + blur (identity card), opaque `--cw-mat-surface` + a **1px `--cw-platform-border`** (stat tiles) | hand-rolled: `--cw-mat-surface` + soft shadow, **no** stroke, **no** grain |
| radius | `--cw-card-radius` (20px) / `--cw-radius-sm` (12px) | `--cw-radius-lg` (28px) |
| value type | editorial Cormorant 700 | UI 600 |
| label type | mono, `--cw-font-data` | uppercase UI |

Neither half was wrong on its own; they were simply two different answers to "what is a card here", eight inches apart. The fix was not to reconcile them but to delete both and declare `data-cw-material="matte"` on every panel — the recipe owns stroke, grain and shadow, and `Cabinet.module.css` sets layout and radius only. Three rules now hold the page together, and they are cheap to check in review:

- **one radius per job** — `lg` = panel, `md` = nested in a panel, `btn`/`pill` = control;
- **serif has exactly one job** — titles. Values are UI 600, never editorial;
- **one label idiom** — the uppercase UI label; the mono/data variant is gone from this surface.

The landing-style photo hero went with it. A full-bleed photo block pushed the controls the cabinet exists for below the fold, and it was the thing forcing a second surface vocabulary in the first place: cards over photography need the media tint, cards over the canvas do not, so the page could not have one answer while the hero stood. The profile's header is now the first panel of the page in the page's own material.

168 lines of profile-only CSS were deleted from `PlatformComponents.module.css` and `PlatformResponsive.module.css` (`profileHero*`, `profileStat*`, `profileSummaryList`, `profileScore*`, and the `[data-cw-profile-hero]` responsive overrides). Removing the hero also restored the shell's automatic topbar clearance — `.shellOverlay > main:not(:has(> [class*="heroFeature"]:first-child))` — so the page no longer hand-computes it.

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

**The mobile hero is the photograph, on all five landings** (2026-08-17 — way21 and reset-day had it, `data-cw-hero="photo"` on `<html>` turned it on for consult, herbs and dosha). Below 881px the hero goes full-bleed: the photo fills the viewport, the copy sits on an opaque scrim band at the bottom, and the band is sized by its own copy. Two consequences worth knowing before touching it:

- **Copy length decides how much photograph is left.** At the shared type scale a five-line sub-head took ~70% of the viewport on the three landings with longer copy, and the hero collapsed into a dark card with a strip of image above it. The photo hero therefore runs its own tighter type scale on *every* mobile screen, not only short ones, with a second step down under `max-height:700px`. Nothing is clamped or hidden — a hero's promise has to be readable in full.
- **`--cw-hero-photo-height` works backwards from the intuition.** It shortens the image box, and because the copy band covers the *bottom* of that box, a **shorter** box puts **more** of the composition above the band. herbs runs 50svh (the packets are mid-frame and only the head cleared the band at full height), consult 72svh, dosha 50svh plus an `x` shift (a 16:10 master in a portrait box loses ~70% of its width to the cover crop; holding the box nearer its own proportion keeps the group readable). way21 and reset-day keep the full-height default — their masters put the subject high in frame already.

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

**Three photo blocks per landing is the base budget** (2026-08-17), hero included. It is a budget, not a cap — the reason to hold it is that a photograph stops carrying weight when the page is full of them, not that four is forbidden. A phase card that opens with a photograph also drops the 4px accent stripe (`.phase:has(.ph-photo)::after{content:none}`): two openers stacked, and the accent cuts the image with a colour the photograph does not contain.

Two things that are *not* carriers. **Chrome**: chevrons, carousel arrows, the arrow inside a button. Excluded by glyph name; the few affordances that reuse a content glyph (a play badge on a video thumbnail, a check on a guarantee line) declare themselves with `class="ico ico-chrome"`. **Typography**: `★`, `✓`, `—` are characters — they take the type colour and metrics and stay. An emoji is a picture with its own palette that no stylesheet can reach, so `👋` and `☝️` are never carriers and the guard fails on them.

`npm run guard:carriers` enforces this per `<section>` across all five CenterWay landings. `--report` prints every block with what it carries; `--surface <name>` narrows to one while working on it. Short and IREM are out of scope — other authors, own stylesheets.

The full role/carrier map across all five landings and the platform is in [ds-carrier-map-2026-08-17](archive/working-notes/ds-carrier-map-2026-08-17.md).

**Icons come from the sprite, not from the file.** 38 → 40 glyphs, baked from `scripts/lib/icon-glyphs.mjs`, emitted to `public/cw/icons/cw-icons.svg` (platform) and `src/landing-static/shared/img/cw-icons.svg` (funnel hosts, which cannot read `/cw/**`). Static landings reference it directly:

```html
<svg class="ico" width="20" height="20" aria-hidden="true" focusable="false"><use href="/shared/img/cw-icons.svg#cw-check"/></svg>
```

The glyph inherits `currentColor`, so colour is the call site's job and dark panels need no override. The carrier guard counts any inline `<svg>` that is not a brand mark as an icon — pasting a path back in does not get past it. Brand marks (YouTube, Telegram, Instagram, Facebook in the footer) stay inline on purpose: they are somebody else's trademark, not our icon language.

**One connective layer, two implementations.** The `dot / orbit / rail / connector` primitives ship as sprite symbols for fixed-size inline marks. A rail that has to span a responsive row is CSS instead — `.rail-node`, one node per card, dashed line bleeding to the card edges by `--rail-bleed` (the host card's own inline padding) so only the grid gap interrupts the run. It is CSS because these rows reflow (7 → 2 → 1 columns on way21's day rhythm, 3 → 1 on the step triads) and a fixed-`viewBox` SVG cannot follow that without stretching its dots. It carries the same terms as the symbols: 1.5px dashed line, filled nodes, accent on `--cta`. In use on way21 (the day), reset-day (`#route`), consult and dosha (the three steps).

#### Network surfaces on the material

Depth is rebound rather than rewritten: `--shadow-soft` / `--shadow-med` in `network-tokens.css` now resolve to the material's shadows, which moves every card, panel and hover state in `landing.css` at once. The dark offer block takes `--cw-mat-inverse-bg`, and the sticky CTA takes the chrome tint, material filter and grain — the same surface as the platform topbar.

Card faces dropped their hairline and take the platform's treatment instead: material surface, no border, a resting soft shadow. Two things to know if this is ever revisited:

- **The hairline was the edge, not decoration.** These cards had no resting shadow at all — only a hover one — so removing the border without adding a shadow made them vanish into the canvas. Cream-on-cream needs one or the other.
- **No inset top highlight.** An earlier pass folded one into the depth token; it read as glossy shine rather than matte glass and was removed everywhere 2026-08-17 (see "Material on the network surfaces" above).

Note the pipeline asymmetry with the platform: landing CSS is served **raw**, not through lightningcss, so the hand-written `-webkit-backdrop-filter` lines there are harmless (they are fatal on the platform — see the two backdrop-filter rules above). Do not "fix" them by symmetry without checking which pipeline the file goes through.

Note for local checking: `/way21`, `/reset-day` and `/herbs` resolve to the static landings on `localhost` — each is a route handler under `src/app/<name>/route.ts` that reads `src/landing-static/<name>/index.html` off disk (fresh read in dev, cached in prod). `/herbs` joined them 2026-08-17, replacing a `permanentRedirect` to `/products/herbs`; the catalogue page still lives at its own URL, but the funnel entry now serves the funnel. `/consult` and `/dosha-test` are still **Next platform routes** locally; those static versions are reachable only through their brand host (in a browser, map `*.centerway.net.ua` to `127.0.0.1`).

## Theming

- Public platform: single light theme in `:root`.
- Admin: dark theme via `.dark` class, toggled by `src/components/ThemeSwitcher.tsx` (mounted in `src/app/(platform)/admin/layout.tsx` only). Public surfaces have no dark mode; that is a decision, not a gap.
- `token_packs.json` defines full named theme families (`warm-mineral`, `living-mineral`, `natural-premium`). This is the designated mechanism for giving a future author/brand its own visual territory (one pack per brand, routing by surface) — roadmap stage 3.3. Do not invent a second theming mechanism.

## Coverage Boundary

The contract layer (`route_family_contracts.json` → `screen_manifests.json` → `block_manifests.json`) governs **generated funnel surfaces only**: consult/detox/herbs funnel-entry screens plus the pilot lesson — 5 screen manifests total. It does **not** govern `/programs/*`, `/products/*`, dosha, checkout, profile, or admin. Extending coverage is deliberately deferred until LMS (see meta-audit 2026-06-20, P0-D).

## Typography, Spacing, Geometry (stable invariants)

- Fonts: UI `Manrope`, editorial `Cormorant Garamond`, data `IBM Plex Mono`.
- Spacing scale `--cw-space-{2xs..3xl}` + `--cw-space-section-y`; container `--cw-max-width: 1160px`.
- **Radii: one scale, chosen by the size of the object** (2026-08-21). `--cw-radius-sm` 12 · `--cw-radius-md` 16 · `--cw-radius-lg` 20 · `--cw-radius-xl` 28 · `--cw-radius-pill`.

  | ступень | for |
  |---|---|
  | `sm` 12 | chips, small plates, list inputs |
  | `md` 16 | buttons, inputs, list rows — `--cw-radius-btn` is an alias of it |
  | `lg` 20 | cards and the topbar — `--cw-card-radius` is an alias of it |
  | `xl` 28 | large panels, covers, the profile header |
  | `pill` | anything genuinely round |

  Nesting: an inner radius is the outer one minus the padding between them (`calc(var(--cw-card-radius) - …)`), never the same value — concentric corners with equal radii read as a mistake.

  This replaced **three** overlapping scales that shipped at once: `--cw-radius-*` (12/18/28), an unused `--ds-radius-*` delivery alias (12/16/20), and a standalone `--cw-card-radius` (20). `md` therefore meant 18 in one file and 16 in another, and a single mobile screen rendered six different corners (12, 14.4, 16, 16.8, 20, 21.6 px). Viewport-interpolated radii (`clamp(1rem, 4vw, …)`) are gone for the same reason: a corner that changes with the window cannot belong to a scale.
- Touch target minimum `--ds-touch-target-min: 3rem` (canonical since e0c7dbc).
- Breakpoints: mobile ≤ 560px, tablet 561–900px, desktop ≥ 901px.
- **The tablet band gets desktop content and phone chrome (2026-08-21).** The three names above were real in the token file and not in the CSS: `561–900` carried a handful of hero and footer tweaks, and everything else fell through to the phone. An 834px iPad therefore rendered a snap carousel of 626px offer cards — one visible, the next cut at the edge — and body copy running the full 800px. Five pixels wider, at 905px, the same content came out two-up in a 428px grid. The cliff was the layout, not the width.

  The band now takes the desktop's *content* shape and keeps the phone's *chrome*: `programShowcase` / `aggregateRail` become a two-column grid (no snap, no edge bleed), and `grid2` / `grid3` / `relaxedGrid` / `videoActionGrid` go two-up. The topbar stays a drawer, because the full nav needs ~790px before the wordmark and the avatar are placed — more than an iPad in portrait has — and a drawer is the better touch target anyway. `split` and the author panel stay stacked: both set a portrait beside prose, and at 800px the text column comes out narrower than the photograph.

  Card height, copy clamps and gaps stay the rail's values. The cards are matched objects on a tablet for the same reason they are on a phone.
- **Stat tiles take values, not sentences.** A tile in a column row (cabinet identity: доша / навчання / продукти) holds a name, a count, or `—`. An empty state is the em dash; the sentence that explains it belongs to the card below, with the action that resolves it. The row reserves two lines of value so a compound result (`Вата-Пітта`, which wraps at 320px) cannot shove the rest of the page down, and breaking is at the hyphen — never `overflow-wrap: anywhere`, which splits words mid-letter.

## Installed-app chrome (PWA)

The platform is installable, and an installed launch is a different surface from a browser tab: there is no address bar, no back gesture affordance on Android's gesture nav, and the bottom edge belongs to the app.

| Piece | Where | Rule |
|---|---|---|
| manifest | `src/app/manifest.ts` | `standalone`; `background_color` / `theme_color` both read `PLATFORM_GROUND` |
| browser chrome | `src/lib/platform/chrome.ts` → `viewport.themeColor` in all three route-group roots | one literal `#faefe0`, mirroring `--cw-sem-calm-bg`. Next serialises `<head>` on the server, where no custom property has resolved yet — so it is a literal, and the one copy lives in that module so the manifest and the roots cannot drift |
| worker | `public/sw.js` | precaches exactly one document (`public/offline.html`) and serves it only when a navigation fails. **No content caching** — a deploy must never be shadowed by a stale copy |
| offline page | `public/offline.html` | fully inline (no hashed Next asset can be referenced), colours copied from the default ground by hand |
| runtime | `PwaRuntime` | registers the worker after `load`, and stamps `data-cw-standalone` on `<html>` — `@media (display-mode: standalone)` is iOS 16.4+, `navigator.standalone` covers older home-screen launches |
| install offer | cabinet → Акаунт | Chrome's parked `beforeinstallprompt` or, on iOS Safari, the two-tap instruction. Neither renders once standalone |

**`theme-color` paints the browser's surround, not the tab strip (2026-08-21).** It tints Android Chrome's address bar, iOS's status bar, and — the case it was added for — the title bar of the installed standalone window, which otherwise opens in the OS grey the app uses nowhere else. Desktop Chrome's tab strip follows the browser theme and no page can repaint it; that is a browser rule, not a gap here.

One value, no `prefers-color-scheme` pair, because the platform ships one theme: the dark palette exists under `[data-cw-theme="dark"]` and nothing sets that attribute (see "Public dark mode"). A dark `theme-color` would hand a dark-OS user a dark title bar over a page that is still cream. When dark is switched on this becomes a keyed pair — and, because the choice will be a toggle rather than the OS setting, a runtime meta update rather than a media query. The 26 static landings carry no `theme-color` yet; they are a separate head and a separate author's skin.

**There is deliberately no bottom tab bar.** One was built and removed on 2026-08-20: on a handheld the platform's own topbar already carries the same five destinations one thumb-reach away, so a second bar was a duplicate of it rather than app chrome. If it ever comes back it needs a job the topbar cannot do — not the same nav in a second place. (Recoverable from git if that job appears; it sat at the media floor, 86%, because a bar pinned to the bottom of the viewport gets whatever the page scrolled under it, including a hero photograph.)

## Mirror protocol (claude.ai Design project)

The design system is mirrored as a Claude Design project — `CenterWay Design System`, projectId `216f0b49-cc48-417f-9194-2c6c5be6d11b` — used as a live specimen surface and a prototyping sandbox.

**Direction is one-way: repo → project.** Authority runs canon → this file → the project. When they disagree, the project is stale, not right.

The token layer is machine-owned, so it can no longer drift by hand:

| Step | Command | What it does |
|---|---|---|
| export | `npm run ds:export` | derives `data/design-tokens/ds-bundle/**` from `cw.tokens.json` — primitives, colors, geometry, material (values *and* recipe), delivery, `styles.css`, plus `_sync.json` |
| gate | `npm run ds:sync:check` | re-derives and fails if the committed bundle is stale or was hand-edited. Runs inside `ds:qa` |
| push | agent, via the `DesignSync` tool | `finalize_plan` → `write_files` with the bundle's files at the project's own paths |

`_sync.json` carries a sha256 per file plus a hash of the token source. Reading that single small file from the project tells you whether the mirror is current — no need to download and diff every file. If `tokensSource` there differs from the one `ds:export` writes locally, the project is behind.

**What is *not* machine-owned:** components, `ui_kits`, guideline cards, templates and the readme are hand-authored in the project. They are synced by hand when the behaviour they describe changes — the export deliberately does not overwrite them.

**Specimens belong in the project, not in one-off pages.** A comparison, a palette study, a state matrix: author it as a `@dsCard` guideline card in the project so it lives beside the system it argues about, instead of as a standalone HTML that nobody finds again.

Legacy names retired in the product (`--cw-depth-*`, `--cw-component-glass-*`) survive in the project only as a marked compatibility block in `tokens/material.css`, kept until its components migrate. They must not come back here.

## Drift probe, and the first three findings (2026-08-23)

`ds-drift/1` (`docs/design-system/DESIGN_CONTRACT.md`) reads three roles — **code**
(`globals.css`, the only thing a user sees), **mirror** (the exported bundle the
Claude Design project holds) and **brief** (this file) — and reports where they
disagree. It is read-only by contract: discovery and closure never run in one
pass, because a probe that also fixes cannot report honestly what it found.

```
npm run ds:drift          # print, change nothing
npm run ds:drift:report   # the same, written to docs/design-system/drift/
npm run ds:drift:gate     # CI form — exits 1 only on a gated pair
```

The 22.08 baseline raised three things. All three are settled here; the value of
recording the verdicts is that the next report can be read in a minute instead
of re-derived.

**1. The inverse gradient — the brief was stale, the code is right.** The
document claimed `#173027 → #274a3c`; the code ships
`linear-gradient(165deg, #182a20, #2c4635)`. Neither stop matched, which is the
worst kind of disagreement in the darkest material in the system. The code wins
on evidence, not on precedence: the gradient moved on 2026-08-21 (`5ca9f6f`)
so the platform's night side would match the landing network's
`--cw-net-hero-scrim` — the same commit's own prose says so — and
`guard-contrast.mjs` asserts the panel's text against `#2c4635` as the lighter,
harder stop. The table above now carries the shipped value. The lesson is
narrower than "update the doc": that commit changed a documented value without
saying it did, and the drift probe is what caught it two days later.

**2. `[data-dosha-test="true"]` is a bridge, and stays outside the token file.**
The block at the end of `globals.css` rebinds ~25 admin-tier chrome tokens
(`--cw-bg`, `--cw-surface*`, `--cw-status-*`, `--cw-shadow*`, …) onto
`--cw-platform-*` / `--cw-sem-*` values. It is why the probe reports 32
*one-sided* findings: for each of those names the code declares a third value
the mirror never does.

It is **not** promoted into `layers.modeOverrides`. A mode is a theme the whole
surface takes; this is one component's bridge — the dosha test is built from the
admin-tier `.cw-btn-*` / `.cw-choice-btn` classes and has to render in the
platform palette without those classes being rewritten. Lifting it would ship 25
declarations to every page to serve one route.

The invariant that keeps it honest: **the bridge may only rebind, never
introduce a value.** Every declaration in it is a `var()` or a `color-mix()` of
tokens that already exist one tier up. A raw hex appearing there means the
bridge became a palette, and it belongs in `cw.tokens.json` instead. The
one-sided count is the metric — it should track the size of that block and
nothing else.

**3. The nine code-only tokens were three different things, not one drift.**

- `--cw-font-ui` / `-editorial` / `-data` — **not drift.** The export filters
  the type layer out (`TYPE_PREFIXES` in `ds-export.mjs`), because the mirror's
  `tokens/fonts.css` carries `@font-face` rules that no token file can derive,
  and its `tokens/typography.css` is hand-authored beside them. Both were read
  from the project on 2026-08-23: the three families are declared there with
  values identical to the code. The probe's `mirror` role points at the
  *generated* bundle — five of the eight files `styles.css` imports — so three
  hand-authored files are invisible to it by construction. This is a known limit
  of the model, recorded in `design.drift.json`, not a gap in the system.
- `--cw-course-*` (5) — **deliberate, and stays out of `cw.tokens.json`.** They
  are a course-scoped layer: an author picks `headingFont` and `scale` from a
  closed list in `src/lms-core/theme.ts`, and the values land on
  `[data-cw-course-*]` scopes. They are per-course choices expressed as
  variables, not system tokens, and putting them in the token file would say the
  system has an opinion about them.
- `--cw-branch-grid-discipline` — **retired from the browser (2026-08-23).** It
  reached `:root` of every page through `layers.routeOverlays.platform`, and
  nothing in `src/` read it: no component, no stylesheet. It belongs to the
  generator, which reads it from `data/generator/branch_overlays.json`, so the
  layer stays in `cw.tokens.json` and `generate-design-tokens.mjs` simply no
  longer flattens it into the runtime block. A token that ships and is never
  resolved is payload, not a system.

**The `brief -> code` pair has a blind spot, and it is now accounted for.** The
code side is read as CSS declarations, and the pair keeps only those whose
*whole* value is a bare hex (`valuePattern: "^#"`). A hex inside a
`linear-gradient()` or a `color-mix()` therefore never reaches the code side,
while the brief quotes it happily — so a shipped colour can read as
"only in brief" forever. As of 2026-08-23 that list is ten entries and none of
them is drift:

| entries | what they are |
|---|---|
| `#173027`, `#274a3c` | the retired inverse stops, quoted in the record of their retirement above |
| `#182a20`, `#2c4635` | shipped — but only inside `--cw-mat-inverse-bg`'s gradient, which the pair cannot see |
| `#55806a`, `#56804f`, `#588768` | "moved from" history: the network and course greens next to the values that replaced them |
| `#1d3a30`, `#b0b0b0`, `#d1cdc6` | measurements quoted in prose (a CTA stop, a grain comparison), never tokens |

Re-derive this table when the count changes; do not re-derive it because the
count is non-zero.

**What the probe is for.** Conflicts were zero in both passes — the export layer
(`ds-export.mjs` → `ds:sync:check`) is doing its job, and no token disagrees with
itself across the two machine-derived sides. Everything it found was either a
hand-authored side that moved alone (1), or a scope one side does not model
(2, 3). That is the expected shape of findings once the generated half is gated,
and it is why the `brief -> code` pair stays on **watch** rather than gated: one
of its sides is prose.

## Validation Stack

`npm run ds:qa` = canon:guard → tokens:check → guard:ds-contract → guard:contrast → generator:validate → semantic:audit → lint → build.

| Gate | What it actually covers |
|---|---|
| `canon:guard` | canon files exist, preflight sentinels, raw-hex allowlist + no local `--cw-*` defs over platform CSS, manifest cross-references |
| `tokens:check` | codegen JSON→CSS is a no-op on a clean tree (drift gate) |
| `guard:ds-contract` | `--ds-*` delivery + landing token contracts, required `--cw-sem-*`/`--cw-platform-*` floor, cross-layer consumption bans, no `--cw-color-*` reintroduction, hero content parity |
| `guard:contrast` | WCAG contrast of rendered text/CTA pairs resolved from `cw.tokens.json`, both themes — platform light + admin dark (body ≥ 4.5, large/CTA fills ≥ 3.0). Since 2026-08-15 also composites the translucent material: 10 glass/inverse pairs checked against the worst backdrop each context allows |
| `generator:validate` + snapshot/determinism/language/rhythm | generator layer |
| `guard:buttons` | The button contract: no component stylesheet may declare button geometry, type or the gold ramp — it composes a role from `PlatformButtons.module.css`. 42 rules checked; named exemptions carry their reason in the source |
| `semantic:audit` | route-family contracts, block order, route invariants (alias redirects exist + redirect correctly) |

Contrast watch (`guard:contrast`): two light CTA fills sit in the large-text tier below body AA — `accent-contrast` on `guide-primary` (4.34) and on `boundary` (4.17). They pass at 3.0 as large/semibold labels but are the first candidates if the palette is retuned for a stricter bar. All `.cw-btn-primary` states and every dark admin text pair pass body AA.

### Orphan tokens (defined, no consumers)

Tracked so no one assumes they render:

- `--cw-role-*`, `--cw-cta-*` (in `token_packs.json`) — carried by packs for the dormant generated-app runtime; zero CSS consumers.
(none in the material layer — the shell and block migrations consumed it.)

Retired 2026-08-23, do not reintroduce into the runtime block: `--cw-branch-grid-discipline` (generator layer; see the drift-probe section).

Retired 2026-08-15, do not reintroduce: `--cw-component-glass-*`, `--cw-surface-glass-*`, `--cw-surface-shell-*`, `--cw-shell-frost-*`, `--cw-depth-*`, and the whole `layers.componentRecipes` branch. Their 49 consumers now read `--cw-mat-*`.

The absorption kept the axes apart rather than flattening them. Depth's *material* half became material proper (`card-bg` → `--cw-mat-surface`, the three shadows → `--cw-mat-shadow-{soft,raised,deep}`). Its *role* half stayed a role but is now expressed as the material shifted by a semantic hue (`--cw-mat-tone-{support,proof,boundary,icon}`), so those panels inherit a dark half instead of needing one invented for them.

**Cards are matte, not glass.** Glass belongs to chrome and to panels over media; a page full of `backdrop-filter` cards costs real frames and reads as decoration rather than as a specific effect.

**A control that sits on dark media inside a light page darkens, it does not lighten.** Hero chips and ghost buttons take `--cw-mat-inverse-control`. Reaching for a light tint there produced a pale pill carrying cream text — caught in review, and the reason this token exists rather than being improvised per component.

Note — `--cw-btn-primary-*` was previously listed here as orphan; that was wrong. `.cw-btn-primary` (globals.css) is a rendered class consumed by `RouteAuthGate` and the dosha test. Its fill was retuned 2026-07-06 (gray-accent mix → success/ink mix) because the old dark pairing was ~2.06; it now clears body AA in both themes and is asserted by `guard:contrast`.

### One nav-state contract (2026-08-23)

Three surfaces answered "you are here" three ways: the topbar drew an ink underline, the cabinet's tab strip drew a gold one, and the account popover underlined its current row in gold via `text-decoration`. Two of them were on screen at once, so the reader had to learn that a black rule and a gold rule mean the same thing.

**One mark, toned.** `--cw-nav-marker` in `globals.css` — ink on a light ground, gold on a dark one — read by the topbar (`--platform-header-nav-marker`) and the account popover. Not a taste call in either direction: on cream, gold measures ~1.05 against the sheet and is not visible as a rule at all; on the night material the ink *is* the cream text, so an ink underline under a cream label is the label drawn twice. Toned by the same three scopes the material uses — `.dark`, `[data-cw-theme="dark"]`, `[data-cw-header-tone="dark"]` — so a portalled popover carrying the bar's tone gets the bar's mark for free.

**The mark is always the second signal.** The active label also runs at full foreground and a heavier weight. That is what keeps the gold mark inside 1.4.11 — it is redundant decoration, not the sole carrier of state — which matters because gold on the dark chrome tint measures 2.34 against the 3.0 a load-bearing indicator would owe. Gold is still not a label colour and nothing here asks it to be one.

**Hover is the same mark, half-drawn.** A fill was the other candidate and loses on the rule this document already writes down for tab strips: these rows sit straight on the page ground, and filling one turns a quiet strip into a row of objects. Rest is muted with no plate; hover and focus grow the mark to `--cw-nav-marker-hover-scale` (0.74) at `--cw-nav-marker-hover-opacity` (0.42) and bring the label to full foreground; active runs it to full. Consumers read those tokens rather than restating the numbers — restating them is how the three marks drifted apart the first time.

**Two baked gestures, one interaction language.** Text navigation uses `ink-stroke`: two slightly non-parallel paths with two restrained ink droplets. Icon-only controls use `ink-ring`: an open, irregular loop plus one tiny drop. Both are graphics baked into `cw-icons.svg`, not CSS drawings, inline SVGs or runtime filters. `--cw-ink-stroke-height`, `--cw-ink-ring-size`, `--cw-ink-hover-opacity` and `--cw-ink-hover-scale` keep the gesture consistent in the topbar, account/mobile menu and Builder. The graphic never carries state alone: active/current also changes foreground and weight and remains exposed through `aria-current`, `aria-expanded` or `aria-pressed`.

### Lists keep their markers inside the text column (2026-08-23)

`.timeline` (the platform's one plain list) hung its bullet at `left: -0.85rem`, on the theory that the sentences should start on the paragraph edge. But a panel's padding is not a margin the list owns: the dots landed left of the eyebrow, the heading and the disclosure row, and only the list broke the block's left edge. The theory also required the panel's padding to be ≥ 1.15rem, and several panels run tighter — on those the dots cleared the card entirely.

Same fix and the same numbers as the lesson player's `.list` (`Lms.module.css`): the item takes `padding-inline-start: 1.15rem` and the marker sits in that indent at `left: 0.28rem`. Hanging markers survive in exactly one place — the builder's structure path, where `.moduleBlock` sets the matching `padding-inline-start` itself, so the glyphs hang into padding the element owns rather than into a parent's.

### `view-rows` / `view-cards` (2026-08-23)

The builder's list-view switch was set in **words** because the icon set had no glyph meaning "a grid of cards", and the two candidates it reached for were both wrong the same way: `menu` is three rules that mean "open the navigation", and the dot/orbit layer is block navigation that `Icon.tsx` forbids inside a text row. The answer to a missing glyph is to draw it, not to set a toolbar in prose — the pair is now baked from `scripts/lib/icon-glyphs.mjs` like every other icon. They read only as a pair: three full-width bands against four half-width blocks is the same page arranged two ways, which is exactly what the control switches between. The word survives as `aria-label` and `title`, because a two-state icon switch has no accessible name without one.

### Buttons: the fit axis (2026-08-23)

The six roles answer what a button *is*. They never answered how wide it should be, so every caller answered that itself — `width: fit-content`, `width: 100%`, `flex: 1 1 100%`, `flex: 0 1 auto` + `min-width`, and nothing at all, across five stylesheets and fourteen rules. Three bugs came out of that in one session: offer-card CTAs sized to their own labels so three cards in a row showed three different stubs; cabinet card actions stacked at the contract minimum and left a third of the card empty beside each; the builder's icon-only options kept the inline padding meant for a label and rendered as wide empty plates. None is a role question — all three are "what does this control do with the space it is given", which is now one axis with four documented answers.

| fit | what it means | where |
| --- | --- | --- |
| `hug` | content width | toolbars, inline controls |
| `fill` | spans the container, still capped by `--ds-button-max-width` | card actions, hero CTAs, offer tiles |
| `wide` | a floor, not a span — two standalone buttons come out one size | page-level pairs |
| `square` | 1:1 at the touch minimum, label padding removed | icon-only |

Compose exactly one alongside a role. The cap staying on `.base` is what makes `fill` safe at any container width: a lone action in a maximised window stops at 22rem instead of becoming a band, and the default offer tile (24rem less 2×1.25rem padding = 21.5rem) is spanned exactly — which is why a one-up and a three-up row draw the same button rather than three sizes of it.

`.row` is the group container: `flex-wrap` with `flex: 1 1 var(--ds-button-min-width)` on the children, so a pair shares one line when both clear the minimum and each takes a full-width line when they do not. **A media query cannot answer this** — the same card is 326px in a three-up grid and 560px in a one-up at one viewport width, which is exactly how the `min-width: 48rem` override that used to sit in `Cabinet.module.css` came to strand 158px beside each button.

### Offer cards carry their own context (2026-08-23)

The home page's herb block ran three icon notes and a "Як читати" panel before the single card they described, and `/products` repeated the pattern — so the reader met three paragraphs about a product they could not yet see. Worse, the prose described *one* product from outside it: a second product would have arrived under an argument about the first, which is the shape a marketplace cannot use.

`PlatformOfferCard` takes `points` — at most three lines of appropriateness, limits and context — rendered inside the card. The copy lives on the offer in `content.ts`, so it travels to the home block, the aggregate page and the detail page unchanged, and the block renders whatever `platformProductOffers` holds. Herbs are one card of one product, which is what they are.

### Blocks name their own aggregate (2026-08-23)

Every showcase block on the home page is a sample of a fuller page — three programmes of five, one product of however many — and the only route to the rest was the topbar, which is a different act of navigation entirely: leaving what you are reading versus following it further. `PlatformBlock` had a `headActions` slot for exactly this and nothing used it. `PlatformBlockLink` fills it, in the `text` role so it does not outweigh the heading it sits beside. Deliberately not automatic: a block whose content *is* the whole set (the proof stories, the support form) has no aggregate to point at, and a dead link there is worse than none.

### `/expert` merged into `/consult` (2026-08-23)

Two pages, one question between them: who runs this, and how do I work with him. Split, each half had to sell the other — a reader who arrived wanting a consultation met a biography, and one who arrived at the biography was sold the consultation a second time. `/consult` survives and `/expert` 308s to it; the credentials (`ExpertProof`) and the route through the work (`ExpertPath`) are now evidence inside the consultation, in `beforeSupport` — after the reader knows what is on offer, before they are asked to commit.

Three things moved with the content and are easy to forget: the `ProfilePage` node (without it the address an answer engine cites for the founder is a redirect), `BRAND.founder.path` (`personLd` builds the Person's `url` from it, so every page's graph would otherwise cite a 308), and `/consult` joining the `platformEscape` / `requestBrand` prefixes. `/expert` **stays** in `platformEscape` — it has to reach the platform for the platform to serve its redirect — and leaves the sitemap, because listing a redirect spends a crawler's fetch on discovering one.

## Aspirational Ledger (not implemented)

Kept out of the descriptive sections above on purpose:

- **7 brand modes** (`sanctuary`, `guide`, `method`, `proof`, `practice`, `progress`, `community`) — concept only; no token, attribute, or class carries them.
- **`organic` visual role** — named in old spec, no token exists.
- ~~`trust` as a first-class token~~ — resolved 2026-07-03: `--cw-sem-trust: #35535f` exists in `layers.semanticAliases` (value carried over from the historic trust palette). Consumers migrate as they are touched.
- **Per-author theming in production** — mechanism exists (`token_packs.json`), zero consumers; activation is stage 3.3.
