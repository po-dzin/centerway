# Platform scale plan: from the 5-landing funnel network to a market-ready platform

Scope date: 2026-07-02
Status: proposal (implementation evidence lives here; durable decisions get promoted to ReOS canon per `docs/CANON.md`)
Related: `docs/landing-funnel-network.md`, ReOS `Лендинги.md`, `Дизайн-токены.md`, `Архитектура.md`

## 1. Where the system stands today

Two layers exist and they are complementary, not competing:

**Acquisition edge — the funnel network.** Five static landings (`way21`, `reset-day`, `dosha`, `consult`, `herbs`) on their own hosts, now fully cross-linked (burger/topbar network nav, `way21 ↔ reset-day` two-way core, `dosha` as free interactive router). Plus the isolated Short/IREM author stream (`reboot`, `irem`). Checkout via WayForPay, leads via `/api/leads`.

**Platform core — the Next.js app.** Already further along than "landing backend":

- catalog pages for **six** programs (`reboot`, `way21`, `ideal-body`, `irem`, `herbs`, `reset-day`) in `src/lib/platform/content.ts`;
- dosha test engine with API, attempts, reminders (`/dosha-test`, `api/tests`, `api/cron/dosha-reminders`);
- user identity: Supabase auth, `api/platform/users/me` + `sync`, a 500-line profile client (dosha, purchases, accesses);
- orders/analytics/admin APIs, Telegram integration (`api/tg`);
- a canonical 8-layer design-token system (ReOS `Дизайн-токены.md`, runtime `data/design-tokens/cw.tokens.json`, guards `tokens:build` / `guard:ds-contract` / `ds:qa`).

**The structural gap:** *content delivery is not on the platform.* Every paid product hands the customer to a Telegram bot after checkout ("після оплати — кнопка для входу в Telegram-бот"). The platform has identity, catalog, diagnostics and payments — but no LMS. That is the single biggest lever for LTV, retention and defensibility.

## 2. How the landing network relates to the platform

The network is the **paid edge of one funnel**, the platform is its **owned core**:

```
 ads / social / organic
        │
        ▼
 dosha (free test) ──► segment: vata/pitta/kapha
        │                    │
        ▼                    ▼
 reset-day (795) ──► way21 (4100 / 9000) ──► consult / herbs (alumni, recurring)
        │                    │                        │
        └────────────────────┴────────────────────────┘
                             ▼
              PLATFORM ACCOUNT (profile = dosha + purchases + progress)
                             ▼
              LMS delivery, reminders, next-step offers, repeat cycles
```

Principles that follow:

1. **Every node feeds identity.** A test result, a lead, a purchase — each should create/enrich a platform profile. Today only purchases and the dosha test do; landing leads live in a table nobody logs into.
2. **The network stays thin, the platform gets deep.** Landings sell one decision each (invariant: one primary CTA); the platform owns everything after the decision.
3. **`dosha` is the strategic asset.** It is the only free, shareable, segmenting entry — the top of the funnel and the personalization key for everything downstream (protocol per constitution is the product's core claim).
4. **Scaling the network = adding nodes, not pages.** `ideal-body` is the obvious 6th node: it already has a platform page and a lead code, but no funnel host. Same recipe as way21 (host → static landing → checkout/lead).

## 3. Phased plan to market

### Phase 0 — Launch readiness of the network (1–2 weeks) — **hard gate**

Close the gaps that block paid traffic; nothing new gets built. **Phases 2–3 do not start until Phase 0/1 numbers exist** — the whole ladder strategy rests on an ascension rate (test → 795 → 4100) that is currently unobservable.

- Wire Meta Pixel + Clarity on `way21`/`reset-day` (TODO placeholders in both heads); confirm `CW_trackLead` fires on the three lead forms.
- Replace placeholder pay wiring (`TODO(placeholder)` in `products.ts` approved/declined URLs) and the personal `telegram.me/E_Koriakin` contact with the support bot (blocked on the bot handle — open question from the previous session).
- Remove `noindex` on `way21`/`reset-day` when subdomains go live; add `robots` policy for the three cw-pages deliberately.
- Baseline analytics per node: sessions → primary-CTA clicks → checkout/lead. Without this, no later phase can be judged.
- **Trust/proof upgrade (buyer-council input):** named, dated, specific testimonials (symptom → change), author credentials verifiable at a glance, one free "sample day" of the way21 protocol as a downloadable/preview, and an explicit ladder bridge — the 795 reset-day price credits toward way21 ("апгрейд-залік") so the taster reads as a first installment, not a second purchase.

**Exit criteria:** ad traffic can be bought to any node and attributed end-to-end.
**KPI:** CR per node; cost per lead / per purchase; dosha-test completion rate; **reset-day → way21 upgrade rate (the ladder's load-bearing number).**

### Phase 1 — One identity across the funnel (2–6 weeks)

- Dosha result → profile: after the test, offer "зберегти результат" (email or Telegram login) — **optional capture, never an auth wall**; forced registration on a free quiz trades top-of-funnel volume for CRM vanity.
- Purchase → account: post-checkout `thanks` pages provision the platform account (Supabase) alongside the bot handoff, not instead of it.
- Lead → CRM discipline: leads from consult/herbs get statuses in admin, response-time SLA visible.
- Profile v1.1 = "мій маршрут": constitution, owned programs, recommended next node (reuse the dosha routing logic).

**Exit criteria:** ≥60% of paying customers have a platform account; test-to-contact capture ≥25%.

### Phase 2 — LMS MVP: delivery moves onto the platform (6–12 weeks)

**Precondition (cheap falsification first):** before building, test recurring demand *inside Telegram* — offer alumni a paid monthly "maintenance" channel/cycle. If the audience won't pay monthly in the channel they already live in, an LMS won't fix that; if they will, the build is de-risked. Telegram stays the notification/companion layer permanently (UA course completion via TG pushes measurably beats email-only LMS retention).

Deliver `reset-day` first (3 days, small content), then `way21` (21 days, 3 phases — the structure already maps to lessons).

- Lesson player: day-based protocol (text + video + checklist), progress state per user, phase gates.
- Reminders: reuse the cron infrastructure (`dosha-reminders` pattern) for day-N nudges; Telegram becomes the notification/companion channel, not the container.
- Access control from orders (already in profile as "доступи").
- Author tooling: content lives as structured data, not hardcoded pages — this is what makes adding `ideal-body` and future programs cheap.

**Exit criteria:** a `reset-day` purchase is consumable start-to-finish without Telegram; way21 cohort completion measurable.
**KPI:** activation (day-1 start rate), completion rate, upsell rate reset-day → way21 measured in-product.

### Phase 3 — Full product grid + recurring layer (12–20 weeks)

- `ideal-body` funnel node (6th landing, same static recipe) + LMS course.
- Alumni membership: herbs replenishment + seasonal group cleanses (way21 has "сезонні очищення" webinars already) + community — the recurring-revenue layer on top of one-off courses.
- Consult productized: paid tiers (single / package), calendar booking instead of manual scheduling.
- EN locale for the platform shell (products.ts already carries en strings).

**KPI:** LTV / CAC ≥ 3; repeat-purchase share ≥ 25%; MRR from membership.

### Positioning (applies from Phase 0)

- **Category:** integrative constitution-based recovery — "протокол під вашу природу", not "детокс-курс". The differentiator is personalization by dosha + author supervision, which mass marathon products don't have.
- **Price ladder:** free (test) → 795 (reset-day) → 4100 (way21 self / irem) → 9000 (supervision) → consult/herbs recurring. Every node names its place on the ladder and the next step up.
- **Trust spine:** author credentials + bounded health claims (never medical certainty — this is both a legal invariant and a positioning strength vs. miracle-detox competitors).

## 4. Design-system unification (semantic tokens everywhere)

### Audit: four dialects today

| Surface | Token dialect | State |
| --- | --- | --- |
| Platform app | `--cw-*` semantic layer in `src/app/globals.css` (+ `--ds-*` primitives) | canonical |
| short/irem landings | `--ds-*` public contract (`shared/css/tokens.css`) + landing bridge | canonical-adjacent |
| way21/reset-day | local vars (`--ink`, `--cta`, …) with a partial semantic alias layer (`--landing-color-*`) | intentional isolation, documented |
| dosha/consult/herbs | `--cw-*` names in `funnel-network.css` with **different values** than the platform's `--cw-*` | namespace fork — the real debt |

The last row is the hazard: same names, different meanings. They never load together today, but the fork will bite the first time a platform component is embedded on a funnel page.

### Target architecture (matches ReOS `Дизайн-токены.md`)

```
--ds-* primitives (raw scales)  →  --cw-{group}-{name} semantic aliases
     →  per-landing override block (palette only)  →  component recipes (--cw-nav-*, --cw-card-*, …)
```

### Rollout steps

1. **Done in this change:** first shared component recipe — `shared/css/network-nav.css` (`--cw-nav-*` tokens, per-landing mapping blocks, one markup + `network-nav.js` behavior on all five nodes; mirrors the platform shell's burger pattern).
2. Rename the funnel dialect: `funnel-network.css` `--cw-*` → `--cwf-*` (or fold into `--cw-sem-*` values from `cw.tokens.json`), killing the namespace fork. Mechanical, page-scoped, guarded by `guard:ds-contract`.
3. Promote way21/reset-day `--landing-color-*` aliases to the canonical `--cw-{group}-{name}` form; local primitives stay, semantics unify.
4. Component recipes next in line: card, offer/pricing block, FAQ accordion, lead form (the form markup is already identical on consult/herbs — extract to a shared partial the same way as the nav).
5. Gate every step with `npm run ds:qa` (canon guard → tokens build → ds-contract → generator checks → lint → build); promote the final token ontology change to ReOS canon once stable.

## 5. Council review (adversarial roast) — verdict and amendments

A five-persona adversarial review (contrarian / expansionist / logician / researcher / buyer) was run against this plan. Verdict: **RESHAPE → GO** (scores 3 / 8 / 7 / 7.5 / 4 of 10). Amendments applied:

1. **Cross-node nav vs. funnel math.** A network menu on paid landings is a curated list of exits. Resolution: the nav ships everywhere, but paid-traffic sessions (`fbclid`/`gclid`/`ttclid`/`utm_medium=cpc|paid|ppc`) get slim mode — brand only, no cross-node links, sticky per session (`network-nav.js`). Organic and cross-network visitors keep full navigation.
2. **Ascension is a hypothesis, not a fact.** Phase 0 became a hard gate; the reset-day → way21 upgrade rate is named the load-bearing KPI; Phases 2–3 wait for it.
3. **Trust/proof precedes platform polish** (buyer): specific dated testimonials, verifiable credentials, a free sample day, and an upgrade credit bridging the 795 → 4100 gap are Phase 0 work, not Phase 3.
4. **LMS de-risking** (logician + researcher): recurring demand is tested inside Telegram first; TG remains the notification layer after migration (hybrid, not replacement — this matches how the UA market's bot+LMS stacks work).
5. **Solo-capacity ceiling** (all): membership content must be productized (recorded cycles, seasonal cohorts), not author-time in disguise; consult stays capacity-priced. Diaspora (EU Ukrainian speakers, same language/creative, ~€ purchasing power) is the cheapest TAM expansion and belongs in Phase 3 media planning.

## 6. Risks and invariants

- **Brand isolation:** Short/IREM never cross-link with the platform-author network; profiles may hold both purchases, but marketing surfaces stay separate (`Бренд-контракт`).
- **Health claims stay bounded** in all new LMS/marketing content — strictest on dosha/herbs/way21.
- **Canon governance:** token ontology and route-family changes go through ReOS + guards; repo docs (this file) hold evidence until decisions are durable.
- **Telegram dependency during Phase 2:** run bot + LMS in parallel for at least one full cohort before making the platform the primary container.
- **One primary CTA per node** survives all nav/network additions — the network menu is secondary navigation by design.
