# Platform Program/Product Template Architecture

Date: 2026-05-13
Status: local operational contract

## Why this note exists

The current platform offer layer mixes at least three different surface intents into one half-random implementation:

- long-form platform program offers,
- short mini-course / mini-entry offers,
- legacy one-off program pages outside the generator path.

This creates drift in:

- shell consistency,
- CTA hierarchy,
- block duplication,
- route-family semantics,
- pricing / enrollment behavior,
- content fit between route type and page template.

This note defines the target split before implementation.

## Surface taxonomy

### 1. Platform program offer

Routes:

- `/programs/way21`
- `/programs/ideal-body`
- `/programs/irem`

Semantic role:

- direct platform selling surface for a longer guided route

User question:

- what is this program, what outcome does it produce, how does it work, and how do I enroll here without leaving the platform?

Primary mode:

- `guide + proof`

Template intent:

- structured, editorial, higher-trust, more explanatory than a mini-entry

Required sections:

1. visual-first hero
2. promise / result block
3. method or structure block
4. format / commitment / what is included
5. boundary / expectation
6. enrollment or payment entry

Optional sections:

- proof
- expert context
- FAQ

Forbidden behavior:

- primary CTA to a separate landing
- accidental duplication of semantic blocks under different labels

### 2. Platform mini-course offer

Routes:

- `/programs/mini-detox`
- `/programs/reboot`
- future standalone paid mini-products on the platform

Semantic role:

- direct platform selling surface for a short, low-friction educational entry

User question:

- is this the right quick start for me, what do I get immediately, and can I buy it here now?

Primary mode:

- `guide + commitment clarity`

Template intent:

- shorter, denser, more transactional, less explanatory than a big program page

Required sections:

1. visual-first hero
2. what this entry gives me now
3. compact format / duration / commitment / price
4. fit / who it is for
5. boundary
6. buy or enrollment block

Optional sections:

- support
- one small proof cluster

Forbidden behavior:

- long-form “course brochure” layout
- redirecting primary action into a different funnel surface

### Reserved term: product

`product` is reserved for physical product surfaces such as herbs, supplements, or future tangible support goods.

It should not be used for digital mini-courses.

### 3. Funnel-only landing

Routes:

- `/reboot`
- `/short` (compatibility alias for reboot funnel)
- `/irem`
- `/consult`
- `/detox`
- `/herbs`

Semantic role:

- isolated conversion surface

This remains separate and must not share platform page IA by default.

## Current drift

### Structural drift

- `GeneratedRouteScreen` is used for some platform offers.
- legacy `ProgramDetailPage` created a parallel page system for other `/programs/*` pages.
- `mini-detox` exists both as platform route and as mini-course entry surface.

### Semantic drift

- `offer.info` currently tries to cover both long programs and mini-entry products.
- some routes behave like program pages but have mini-course economics.
- some platform pages still inherit old funnel assumptions.

### Commerce drift

- platform pages still leak into landing/funnel logic instead of completing the sale inside the platform surface.

## Target runtime split

### Route-family level

Keep isolated funnel surfaces separate.

Inside the platform create two durable archetypes:

- `platform-program-offer`
- `platform-mini-course-offer`

These are both platform routes, but they do not share the same required block stack.

### Renderer level

Replace one overloaded `offer.*` renderer family with two template families:

- `program-offer.*`
- `mini-course-offer.*`

Suggested variants:

- `program-offer.hero`
- `program-offer.results`
- `program-offer.method`
- `program-offer.format`
- `program-offer.enroll`
- `mini-course-offer.hero`
- `mini-course-offer.value`
- `mini-course-offer.format`
- `mini-course-offer.fit`
- `mini-course-offer.buy`

### Content level

Every platform offer entity in `src/lib/platform/content.ts` should declare:

- `surfaceType: "program" | "mini-course" | "product"`
- `conversionMode: "lead" | "direct-pay" | "hybrid"`
- `primaryActionKind: "enroll" | "buy"`

This removes template inference by slug.

## Route mapping target

### Program template

- `way21`
- `ideal-body`
- `irem`

### Mini-course template

- `mini-detox`
- `reboot`

## Implementation order

1. add explicit content taxonomy to platform offer entities
2. stop using `ProgramDetailPage` as a parallel page system
3. split archetypes/contracts into program vs mini-course
4. split renderer variants accordingly
5. route all `/programs/*` pages through the same platform shell/runtime path
6. wire payment mode per offer surface

## Canon sync trigger

If this split becomes the stable rule for all platform offers, promote the minimum durable rule into:

- `UI-UX канон.md`
- `Блоки и компоненты.md`
- potentially `Генератор экранов.md`

For now this note remains local operational guidance.
