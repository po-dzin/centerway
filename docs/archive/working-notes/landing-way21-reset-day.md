# Funnel pair: Шлях 21 (`/way21`) + Розвантажувальний день (`/reset-day`)

> Superseded for the network view by [`docs/landing-funnel-network.md`](../../landing-funnel-network.md):
> `way21`/`reset-day` are now the core of the platform author's five-landing mini-network
> (`way21`, `reset-day`, `consult`, `dosha`, `herbs`). Prices below are pre-`4100/9000`.
> This note is kept for the pair's original build detail.

Scope date: 2026-06-25
Status: built, pre-launch (placeholder pay/bot wiring), `noindex` until launch.

## What this is

A second isolated funnel pair for CenterWay, mirroring the `short`/`irem` relationship:

- **`/way21` — Шлях 21**: premium, deep 21-day integrative detox program. Two packages — **самостійний 3100 грн** (`way21`) and **індивідуальний супровід 5200 грн** (`way21-support`), both payable. The "expensive serious product".
- **`/reset-day` — Розвантажувальний день**: light, emotional 1-day conditional-fasting mini-course (795 грн, old price 1200 грн struck for anchoring). The low-threshold entry.

Both are built on the **`irem-v2` premium pattern** (not the legacy `short`/`irem` `prepareLandingHtml` pipeline): a self-contained static HTML with inline DS-scoped tokens, its own `js/common.js`, served by its own route handler. Shared platform foundation (Formular font, atmosphere/grain, irem-v2 component vocabulary); local accents per product.

## Palettes (green–gold–mineral, no coral)

Tokens are scoped to `[data-cw-landing="way21"]` / `[data-cw-landing="reset-day"]` (never leak to `:root`). Same variable *names* as irem-v2 (internal), different *values*.

**Shared brand accent (both):** platform gold `--cta:#dba54f` (= DS `--cw-sem-warmth` / `--cw-platform-accent`), rendered as **dark-ink-on-gold** for AA (`--on-cta` = each product's deep green ink, not white). Gold is the brand constant; the green base is what differentiates the two:

- **way21**: deep mineral forest ink (`#1d3a30`), route green (`#3f6f63`), gold accent + `#1d3a30` ink-on-gold, dark gradient `#173027→#274a3c`. Heavier/premium/dossier.
- **reset-day**: lighter sage ink (`#284a3b`), light sage route (`#588a72`), same gold accent + `#22382e` ink-on-gold, brighter canvas (`#f9f7ef`), larger radii. Lighter/airier/emotional.

## Files

- Routes: `src/app/way21/route.ts`, `src/app/reset-day/route.ts` (organic-only, CDN-cacheable; no offer injection — fixed price).
- Static landings: `src/landing-static/{way21,reset-day}/` — `index.html`, `js/common.js`, `fonts/` (Formular), `img/` (placeholders from irem-v2 + platform `way21-*`).
- Shared-core registration:
  - `src/lib/landing/contracts.ts` — `way21`, `reset-day` added to `LANDING_STATIC_BRANDS` (asset serving via `[brand]/[...path]`).
  - `src/lib/products.ts` — `way21` (3100), `way21-support` (5200) and `reset-day` (795) added to `PRODUCTS` (all payable); `normalizeProduct` + `isPayableProduct` extended.
- `common.js` per product sets `PRODUCT` / `OFFER_ID` / `PRICE_VALUE`. CTA `.openModal → /api/pay/start?product=…` (same flow as irem). **way21 `common.js` supports per-CTA package selection**: a button may carry `data-cw-product` / `data-cw-offer-id` / `data-cw-price-value` (self `way21`/3100 vs supervision `way21-support`/5200), falling back to page defaults.

## Subdomain routing (hosts)

Funnel hosts resolve via the Next 16 middleware (`src/proxy.ts`) + the surface registry (`src/lib/surfaces/catalog.ts`), same pattern as `irem.centerway.net.ua → /irem-v2`:

- **`way21.centerway.net.ua`** → brand `way21` (`funnelRuntime: "landing-app"`, `internalFunnelRoute: "/way21"`) → serves the `/way21` route handler. **Replaces** the old detox subdomain.
- **`resetday.centerway.net.ua`** (no hyphen) → brand `reset-day` → serves `/reset-day`.
- Assets (`/way21/*`, `/reset-day/*`) bypass the proxy via `LANDING_STATIC_BRANDS` → `[brand]/[...path]` catch-all.
- Utility pages now exist and resolve on clean funnel paths too: `/way21/thanks`, `/way21/pay-failed`, `/way21/public-offer`, `/way21/index2` and the matching `/reset-day/*` routes map to their authored static HTML (`thanks.html`, `pay-failed.html`, `public-offer.html`, `index2.html`) while preserving each landing's own `page.css`.
- **`detox.centerway.net.ua`** retired: `detox.host` set to `null` + a **308 redirect → `https://way21.centerway.net.ua/`** in `proxy.ts` (`RETIRED_FUNNEL_HOST_REDIRECTS`).
- Pay return URLs (`products.ts`): `way21`/`way21-support` → `way21.centerway.net.ua`, `reset-day` → `resetday.centerway.net.ua` (placeholder paths until thanks/pay-failed pages exist).

**Infra (manual, outside repo):** add `way21.centerway.net.ua` and `resetday.centerway.net.ua` as domains in the Vercel project + DNS CNAME records; point/retire `detox.centerway.net.ua` DNS as desired (the app already 308s it).

Verified via `curl -H "Host: …"`: way21/resetday serve their landings, detox host 308s to way21, irem/reboot unaffected, `npm run build` green.
Verified 2026-06-30: clean utility routes for both funnels return `200`, and browser smoke confirms `thanks` starts `/api/events` before the Telegram redirect while keeping the manual bot CTA visible.

## way21 system/format depth (sources embedded)

Two source docs are integrated into way21 (depth balanced with accessibility per brand voice — concrete, calm, boundary visible):

- **`Complete_3_Weeks_Detox_Program_V3.pdf`** (weekly phyto-module matrix) → folded into the 3-phase cards (`.triad`): each week shows its **фітозбір** composition + ayurvedic **завдання** + outcome (Week 1 декомпресія/лімфодренаж; Week 2 «ударний прийом» сорбція/мукопротекція; Week 3 «напій спецій» агні).
- **`Дослідження проекту Шлях 21.docx`** (methodology research) → a collapsible **`.ai-card` "Наукове підґрунтя"** deep-dive (Панчакарма adaptation, Пурвакарма→елімінація→агні, шроти, reintoxication-prevention, doshas, «мозок–кишківник», 1000+ participants) so casual readers stay light and curious buyers can expand. Also sharpened the `Метод` sci-points (доші Вата/Пітта/Капха, ама), added the «Заслужений натуропат Європи» (2017) + Kerala credential to the author block, and a 1000+ social-proof line.
- Copy fix: «ум» → «розум» throughout (hero, meta, footer, method).

## way21 offer + reset-day cross-block

- Offer (`#offer`) shows **two packages** as `format-card`s: self (dark card, 3100, `data-cta-final`) and supervision (light card, 5200) — both `.openModal` payable with their own package data attrs.
- Below the FAQ, a separate **reset-day soft-entry block** (`.short-block`, 795 грн, ghost CTA → `/reset-day`) splits the big-program format from the mini. This is the **brand-contract exception v1** (a controlled lower fallback to the lighter product, framed as a soft next step, one dominant primary CTA stays on way21) — the analogue of irem-v2's Short block. Isolation otherwise holds: `/reset-day` does **not** link back to `/way21`.

## Section structure (both)

`hero → strip → problem → shift (VS) → 3-phase mechanism → (way21: daily rhythm + method) → included → results accordion (+ med-note boundary) → (way21: audience) → author → proof → offer → faq → footer + sticky CTA`. way21 is the fuller, value-stacked program page; reset-day is shorter and more emotional with a single centered offer.

Brand-canon notes honored: prices visible in main flow; one dominant primary CTA; mandatory health **boundary** block (`.med-note`); **funnel isolation** — no cross-links between `/way21` and `/reset-day` (reset-day only softly hints at "deeper programs" with no href).

## Verified (2026-06-25)

`npm run lint` + `npm run build` pass; both routes registered (dynamic). Preview: 200, palettes/prices/mobile correct, all `/way21|/reset-day` assets 200. `POST /api/events` and `/api/pay/start` 500 **locally for all products incl. existing irem/short** → environment-only (no WayForPay/Supabase config in dev), not a regression.

## TODO before launch (next step — platform/LMS phase)

- Real WayForPay merchant for `way21` / `reset-day`; real `approvedUrl`/`declinedUrl` subdomains (currently placeholder `way21.centerway.net.ua` / `reset-day.centerway.net.ua` in `PRODUCTS`).
- Real Telegram bot URLs (way21 premium card currently → `t.me/E_Koriakin`); thanks / pay-failed / public-offer pages.
- Meta Pixel + Clarity head block (dropped as placeholder; see irem head). Remove `noindex` when promoting.
- Real product photos/video (currently irem-v2 + platform placeholders).
- Premium card price for way21 "Індивідуальний супровід" (currently "індивідуально" → Telegram).
