# Platform-author landing funnel network

Scope date: 2026-07-01
Status: active

Canonical spec: `ReOS/Projects/CenterWay/Лендинги.md` (section "Мини-сеть автора платформы").
Runtime source of truth: `src/lib/surfaces/catalog.ts` + `src/landing-static/**`.

## Two isolated author streams

CenterWay landings split into **two isolated author streams**. Never cross-link between them (see `Бренд-контракт`).

- **Short / IREM author** — `reboot` (a.k.a. `short`) and `irem` conversion funnels (checkout).
- **Platform author (Є. Корякін)** — a connected mini-network of **five static landings**: `way21`, `reset-day`, `consult`, `dosha`, `herbs`.

## The five-landing mini-network

Not five independent funnels — a connected network whose job is to strengthen the `way21 + reset-day` core and route people to the right next step instead of hard-selling.

| Host | Internal route | CTA mode | Role |
| --- | --- | --- | --- |
| `way21.centerway.net.ua` | `/way21` | checkout | Core: deep 21-day program (self `4100` / supervision `9000`) |
| `resetday.centerway.net.ua` | `/reset-day` | checkout | Low-threshold entry: 1-day reset mini-course (`795`) |
| `dosha.centerway.net.ua` | `/dosha-test` | redirect | Interactive router: free 12-question test, does **not** sell directly |
| `consult.centerway.net.ua` | `/consult` | lead (form → `/api/leads`) | Direct personal-consultation booking |
| `herbs.centerway.net.ua` | `/products/herbs` (funnel `/herbs`) | lead (form → `/api/leads`; registry `ctaMode: redirect`) | Herb-blend selection request (no on-page payment) |

All five are `funnelRuntime: "landing-app"` static hosts in `src/landing-static/**`, served through the `[brand]/[...path]` catch-all. `detox` is retired: `detox.centerway.net.ua` returns `308 → way21`, and the old generator `/funnel-entry/*` + `/funnel-support/*` routes were deleted in the static-landing migration.

## Connective logic

- **Temporary active core `way21 ↔ reset-day`.** Until `dosha`, `consult`, and `herbs` receive their next product pass, the only visible cross-landing links are the two directions between `way21` and `reset-day`. The three deferred landings remain directly addressable but have no active header or inbound links from the core pair. The pair holds one premium pattern (green–gold–mineral). See `docs/archive/working-notes/landing-way21-reset-day.md` for the pair's build detail (prices there are pre-`4100/9000`).
- **`dosha` as interactivity over the core.** The free test is the added interactivity that strengthens the bundle: by result (`vata/pitta/kapha` + pairs) it points a visitor to the right node. Engine and segmentation live in the dosha-test module (`src/app/(platform)/dosha-test/**`); `dosha` makes no medical claims and does not sell a program itself. `way21` links to the test from its method section ("don't know your dosha?").
- **`consult` as the direct path.** For people who want personal guidance rather than a course: primary CTA is the on-page lead form (`data-cw-lead-form`, `product_code: consult` → `/api/leads`), no on-page payment.
- **`herbs` as the alumni path.** Herb-blend selection for people who completed the programs or want a small standalone step; primary CTA is the on-page lead form (`product_code: herbs`), not a cart.

## Implementation

- Shared network runtime: `src/landing-static/shared/js/funnel-network.js` + `src/landing-static/shared/css/funnel-network.css` (reveal, sticky CTA, smooth anchors, cross-node nav block).
- Cross-node navigation is carried by one shared component on **all five nodes**: `shared/css/network-nav.css` + `shared/js/network-nav.js`. Its current two-item menu is `way21 ↔ reset-day`; it is intentionally suspended everywhere while the deferred landings are reworked. When re-enabled, it has no layout footprint at load, appears on upward scroll (including within the hero), and hides on downward scroll. The `way21 ↔ reset-day` pair is additionally linked by content bridges both ways.
- `dosha`, `consult`, `herbs` are full marketing pages (visitor-facing Ukrainian copy: value proposition, method-depth section with bounded claims, author authority, FAQ), not internal "surface" placeholders.
- **One DS for all five — a single token contract.** Per the ReOS canon (`Дизайн-токени.md`), the design system *is* the token contract, not any one component stylesheet. `shared/css/network-tokens.css` is that contract for the whole network: it defines the semantic `--cw-net-*` layer (mineral-green core defaults + one per-landing skin block each) and is linked first on all five landings. Both component dialects consume it:
  - `way21`/`reset-day` `page.css` map their local names onto it (`--indigo: var(--cw-net-route)`, `--cta: var(--cw-net-gold)`, `--cream: var(--cw-net-canvas)`, …);
  - `funnel-network.css` (dosha/consult/herbs) maps the funnel names onto it (`--cw-accent: var(--cw-net-route)`, `--cw-gold: var(--cw-net-gold)`, …); those three `page.css` files now hold only the `--cw-hero-focus` layout knob.
  Change a value in `network-tokens.css` → all five move together. Every consumer keeps a literal fallback (`var(--cw-net-x, #old)`) so a missing token can't regress the visual.
- **One component DS, not just one token contract.** All five landings render from a single component stylesheet `shared/css/landing.css` (the premium `.hero/.sec/.prob-card/.triad/.inc-card/.acc/.author/.offer/.footer/.sticky-cta` system extracted from way21/reset-day) plus the inline lead-form component. way21/reset-day keep a thin `page.css` token skin; dosha/consult/herbs carry no `page.css` at all — their skin lives in `network-tokens.css`. The scale layer (radius/spacing/shadow/type) is unified in `network-tokens.css`, so every page shares one rhythm. Per-landing difference is only: palette skin, imagery, icons, copy, and which/how-many blocks each composes. `funnel-network.css/js` is retired from the landings (still referenced by the generator runtime + rhythm guard, so the file stays).
- **Traceable to platform canon.** The `--cw-net-*` values mirror the platform semantic palette in `data/design-tokens/cw.tokens.json`: `--cw-net-route` ≈ `--cw-sem-guide-primary` (#4f7e76, AA-deepened #3f6f63), `--cw-net-gold` = `--cw-sem-warmth` (#dba54f), `--cw-net-canvas` ≈ `--cw-sem-calm-bg`, `--cw-net-ink` ≈ `--cw-sem-method-ink`. This is the network's shared base with the platform. The earlier pastel blue/teal dialect on dosha/consult/herbs is retired; each landing keeps only a role tint within the one family (dosha = deep diagnostic core, consult = bright mineral trust, herbs = leafier nature, reset-day = light sage, way21 = deep core).
- Cross-prefix assets are safe on any funnel host: `/shared/**` and `/way21/**` are in `LANDING_STATIC_BRANDS`, bypass the proxy, and are served by the `[brand]/[...path]` catch-all (the three cw-pages reuse `/shared/img/cw-mark-ink.svg` and `/way21/img/curator-photo.webp`).
- Host → route resolution: `src/proxy.ts` middleware + `src/lib/surfaces/catalog.ts` surface registry.

## Invariants

- One primary CTA per node, tied to that node's route contract (not generic ecosystem exploration).
- `dosha` stays a resource router, not a direct point of sale.
- Health-related copy stays bounded — no medical certainty or cure claims (strictest in `dosha`, `herbs`, `way21`).
- The platform network never cross-links with `reboot` / `irem` (different author).
