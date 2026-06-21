# IREM v2 Landing — 2026-06-20

Local operational note for the separate `/irem-v2` funnel variant.

## Goal

Build a new separate IREM landing version without replacing the existing `/irem` funnel.

## Route contract

- Current production funnel remains at `/irem`.
- New exploratory direct-sales variant lives at `/irem-v2`.
- Checkout runtime stays on the same `irem` product contract.
- Analytics and payment still use the existing `irem` product identity.

## Semantic contract

- `surface`: product funnel
- `semantic_role`: orientation + method + offer + trust
- `user_question`: "Що таке ІВЕМ, чому цей метод може бути доречним саме мені, і як почати без хаосу?"
- `token_source`: existing global `--cw-*` tokens, no separate local palette
- `content_source`: `Аналіз ІВЕМ_all.docx` + current `/irem` offer facts + CenterWay claim canon
- `route_boundary`: isolated funnel route

## Source adaptation from docx

Material promoted into the page:

- three-phase logic: `збудження -> перерозподіл -> інтеграція`
- weekly rhythm with changing focus by day
- daily base logic from periphery to center
- movement + breathing + attention as a unified route
- emphasis on regularity and life integration over intensity

Material deliberately bounded or excluded:

- absolute phrases such as `цілком автономна`, `ідеально`, `безпрецедентне`, `найвища форма`
- medical-sounding mechanistic claims stated as fact
- totalizing promises like `гарантується`, `абсолютно всі`, `біологічний щит`
- anti-fatigue / youth-preservation language stated as guaranteed outcome

Preferred rewrite patterns:

- `система побудована так, щоб...`
- `практика спрямована на...`
- `за умови регулярної практики...`
- `учасники часто відзначають...`

## Structure of the variant

1. Hero
2. Signal band
3. Fit / pain mirror
4. Why usual attempts fail
5. Method triad
6. Weekly rhythm
7. Session principles
8. Expected changes
9. Trust + reviews
10. Formats
11. FAQ
12. Final offer
13. Short support fallback

## CTA policy

- Primary CTA remains `Приєднатися до ІВЕМ`
- Premium CTA remains Telegram only
- Short remains a lower support fallback block
- No CTA competition at hero level

## Visual pass

- Lower decision blocks use stronger section shells instead of plain page flow.
- `proof`, `formats`, `final offer`, and `short support` are visually separated as distinct trust / offer / support surfaces.
- The route still consumes existing global and landing tokens; no route-local palette was introduced.
- Chosen direction: `Embodied System` — a hybrid of embodied rhythm and authored system clarity.
- Mobile-first is the primary composition rule; tablet and desktop only expand the same hierarchy instead of redefining it.
- Early narrative sections were rebuilt from centered text bands into DS-consistent editorial shells with left rail, section markers, card rhythm, and stronger mobile scanning.
- The route now uses one visual grammar from hero through method blocks: shell surface + section rail + compact cards + offer/trust separation, rather than mixing old landing fragments with near-unstyled text flow.

## Runtime decision

This variant intentionally does **not** introduce a third static landing product.

Instead it:

- uses a dedicated React route;
- keeps `data-cw-landing="irem"` for runtime compatibility;
- reuses current `irem` checkout/event scripts;
- avoids touching the existing `/irem` DOM contract.
