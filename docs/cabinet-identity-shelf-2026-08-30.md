# Cabinet identity and shelf adjustment — 2026-08-30

## Scope

- Surface: personal platform dashboard.
- Route boundary: `/profile` only; the complete course library remains `/learn`.
- Identity block role: orientation — answers «чей это кабинет?».
- Shelf role: progress / next step — answers «какой курс продолжить и где вся библиотека?».
- Token source: existing platform semantic and material tokens delivered through `globals.css` and the cabinet modules.
- Content source: signed-in account identity, platform role and LMS course shelf.

## Decision

- The dosha result is shown in its dedicated progress card and the textual hero fact; it does not frame the avatar.
- A meaningful staff role (`Адміністратор`, `Підтримка`, `Куратор`) is profile context beside the person’s name. It is omitted from the account menu, whose task is navigation and session actions.
- The personal topbar calls `/learn` `Бібліотека`; it names the destination rather than the subset a person owns.
- With one or more courses, `Усі мої курси` remains a plain link to `/learn`, directly below the resume course, with the baked handwritten arrow used for platform forward movement. On desktop the dosha card occupies the adjacent course-card track only, rather than stretching through the library-link row or leaving a card-sized middle slot.
- The cabinet's lower reference sections remain collapsed by default at every viewport. The author editor is a full-width CSS grid on desktop: compact media controls in the left track, all text fields and actions in the right track. An author-selected public-page image is a top banner rather than a background behind identity and course content.
- Author-editor micro-actions follow the reuse-first control rule: adjacent add/edit/remove commands are accessible icon-only contour controls, while ambiguous or primary outcomes retain text. The publishing setting uses the shared system checkbox grammar with its box before the copy.

This is a route-local composition adjustment, not a new cross-platform token or route-family rule; no RAverse update is required.

## Sales fallback — 2026-09-01

The locked-course CTA for Reset Day reaches `/programs/reset-day`. That address is normally a database-backed public offer page, but the established `/reset-day` funnel remains the safe purchase surface while its LMS row is absent or not public. The platform route therefore redirects only this unavailable known program to the funnel; it does not revive the snapshot as learner content or make an absent course readable. This preserves the library CTA contract without changing its control recipe (`selection_family=contour`) or the route's visual composition.

## Universal offer carousel — 2026-09-02

Embedded marketplace collections use one `PlatformOfferCarousel` on the home page, author pages and detail-page recommendations. It exposes three equal cards on desktop, two on tablet and one readable card with the next edge on mobile. A rail is capped at ten cards and ten noninteractive queue dots; a larger source set links to its full aggregate instead of swapping in a second hidden batch. Desktop/tablet have 48px previous/next controls (`selection_family=contour`, boundary role `quiet`), while touch surfaces retain native swipe and snap. The controls derive disabled state from the real scroll edges, preserve keyboard access and remove smooth movement under `prefers-reduced-motion`.

`PlatformOfferCard` supplies the existing whole-card route link, so its visible CTA remains a label for the same single target. Recommendation headers and rail footers link to `/programs` as `Усі курси`. Full aggregate routes are not rails: they render one continuous three-column desktop, two-column tablet and one-column mobile catalogue so the complete set remains visible and comparable. Evidence and route-level rationale: `docs/marketplace-grid-feed-deep-research-2026-09-02.md`.

## Explicit free-offer state — 2026-09-02

The storefront now treats the commercial state as a three-way contract: no active `lms_course_offers` row means inquiry and renders the lead form; `amount > 0` means paid checkout; `amount = 0` means a free LMS entitlement and a direct “Почати безкоштовно” route. The admin catalog accepts zero and rejects a struck-through price for it. Free access is recorded as `lms_enrollments.source = 'free'`; payment routes refuse zero-priced offers, so a free CTA cannot create a payable order.
