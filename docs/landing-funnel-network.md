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
| `dosha.centerway.net.ua` | `/dosha-test` | redirect | Interactive router: 12-question test, does **not** sell directly |
| `consult.centerway.net.ua` | `/consult` | lead (Telegram) | Direct personal-consultation booking |
| `herbs.centerway.net.ua` | `/products/herbs` (funnel `/herbs`) | redirect | Standalone herb purchase (no course) |

All five are `funnelRuntime: "landing-app"` static hosts in `src/landing-static/**`, served through the `[brand]/[...path]` catch-all. `detox` is retired: `detox.centerway.net.ua` returns `308 → way21`, and the old generator `/funnel-entry/*` + `/funnel-support/*` routes were deleted in the static-landing migration.

## Connective logic

- **Core `way21 ↔ reset-day`.** `reset-day` is the low-threshold entry and cross-sell into `way21` (the "expensive serious product"). Linked directly (`way21 → resetday.centerway.net.ua`); the pair holds one premium pattern (green–gold–mineral). See `docs/archive/working-notes/landing-way21-reset-day.md` for the pair's build detail (prices there are pre-`4100/9000`).
- **`dosha` as interactivity over the core.** The test is the added interactivity that strengthens the bundle: by result (`vata/pitta/kapha` + pairs) it points a visitor to the right node. Engine and segmentation live in the dosha-test module (`src/app/dosha-test/**`); `dosha` makes no medical claims and does not sell a program itself.
- **`consult` as the direct path.** For people who want personal guidance rather than a course: lead CTA `Записатися в Telegram` (`https://t.me/E_Koriakin`), no on-page payment.
- **`herbs` as the alumni path.** A standalone herb purchase for people who already completed the programs and don't need another course.

## Implementation

- Shared network runtime: `src/landing-static/shared/js/funnel-network.js` + `src/landing-static/shared/css/funnel-network.css` (reveal, sticky CTA, smooth anchors, cross-node nav block).
- The cross-node nav block is carried by `consult`, `dosha`, `herbs`; the `way21 ↔ reset-day` pair is linked directly.
- **Open gap:** `reset-day` currently emits no outbound network links back into the core/network.
- Host → route resolution: `src/proxy.ts` middleware + `src/lib/surfaces/catalog.ts` surface registry.

## Invariants

- One primary CTA per node, tied to that node's route contract (not generic ecosystem exploration).
- `dosha` stays a resource router, not a direct point of sale.
- Health-related copy stays bounded — no medical certainty or cure claims (strictest in `dosha`, `herbs`, `way21`).
- The platform network never cross-links with `reboot` / `irem` (different author).
