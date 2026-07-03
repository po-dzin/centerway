# CenterWay Design System — Living Reference

## Status

Living operational reference. Supersedes the archived snapshots:

- `docs/archive/working-notes/design-system-spec-2026-05-17.md`
- `docs/archive/reference/design-system-brandbook-extract-2026-06-27.md`

Authority order: RAverse canon (`/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/**`) > this file > archived notes. This file describes the system **as implemented**; aspirational concepts are listed explicitly in the ledger at the bottom, never mixed into the descriptive sections.

Simplification roadmap: `docs/archive/working-notes/ds-simplification-plan-2026-07-03.md` (stages 0–2 applied; stages 3–4 pending).

## System Definition

CenterWay DS is a semantic token system plus a contract-governed screen generator. Build chain as implemented:

```
cw.tokens.json (layers) ──tokens:build──▶ globals.css (:root / .dark)
token_packs.json ──themeCatalog.ts──▶ generator themes
generator manifests (contracts → screens → blocks → semantic blocks) ──▶ funnel surfaces
```

The generated CSS is intentionally flat: layering lives in the JSON source and in this document, not in the runtime artifact.

Codegen-owned marker blocks in `globals.css` (never edit by hand — edit `cw.tokens.json` and run `tokens:build`): `CW_BASE_LIGHT`, `CW_BASE_DARK`, `CW_RUNTIME_TOKENS`, `DS_ALIAS_LIGHT`, `DS_ALIAS_DARK`. Hand-maintained remainder: `--cw-platform-visual-*` gradient stops and everything outside `@layer base` token blocks.

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
| `--ds-*` | delivery alias | `cw.tokens.json` → `delivery.dsAlias` (full contract incl. type/button/offer-card scales; codegen-owned since 2026-07-03) | platform + landing bridge | guard:ds-contract (required-token list), tokens:check |
| `--cw-role-*`, `--cw-cta-*` | generator theme packs | `token_packs.json` | **none yet** — wired into `themeCatalog.ts`, zero CSS consumers; designated per-author theming mechanism, activation deferred until a second real theme exists | generator:validate |
| `--landing-*`, `--product-*`, irem `--color-*` | isolated landing themes | `src/landing-static/**` (hand-maintained) | Short/IREM landings only | guard:ds-contract (cross-layer consumption bans) |

Removed layers: `--cw-color-*` (legacy DS bridge, `appAlias`) was deleted 2026-07-03 — it had zero component consumers. Do not reintroduce the prefix.

Rules that hold today:

- No raw hex in platform component CSS outside the allowlist derived from token sources (canon:guard).
- Landing CSS must not consume `--ds-color-*`, `--product-*`, `--legacy-color-*` cross-layer (guard:ds-contract).
- `tokens:build` must be a no-op on a clean tree (`tokens:check` in `ds:qa`); edit `cw.tokens.json`, never the generated blocks in `globals.css`.
- Landing isolation (Short/IREM own their theme files) is an **author boundary**, not tech debt — do not "unify" it.

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
| `guard:contrast` | WCAG contrast of text/CTA pairs resolved from `cw.tokens.json` (body ≥ 4.5, large/CTA fills ≥ 3.0) |
| `generator:validate` + snapshot/determinism/language/rhythm | generator layer |
| `semantic:audit` | route-family contracts, block order, route invariants (alias redirects exist + redirect correctly) |

Contrast watch (`guard:contrast`): two CTA fills sit in the large-text tier below body AA — `accent-contrast` on `guide-primary` (4.34) and on `boundary` (4.17). They pass at 3.0 as large/semibold labels but are the first candidates if the palette is retuned for a stricter bar.

## Aspirational Ledger (not implemented)

Kept out of the descriptive sections above on purpose:

- **7 brand modes** (`sanctuary`, `guide`, `method`, `proof`, `practice`, `progress`, `community`) — concept only; no token, attribute, or class carries them.
- **`organic` visual role** — named in old spec, no token exists.
- ~~`trust` as a first-class token~~ — resolved 2026-07-03: `--cw-sem-trust: #35535f` exists in `layers.semanticAliases` (value carried over from the historic trust palette). Consumers migrate as they are touched.
- **Per-author theming in production** — mechanism exists (`token_packs.json`), zero consumers; activation is stage 3.3.
