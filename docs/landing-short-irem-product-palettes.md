# Product Color Palettes (`short` / `irem`)

Scope date: 2026-04-21  
Contract: `DS base` + `product semantic overrides via --landing-*`.

## DS Foundation (shared)

| Role | DS token | Hex |
|---|---|---|
| Canvas background | `--ds-color-bg-canvas` | `#fffdf7` |
| Surface | `--ds-color-surface` | `#ffffff` |
| Text primary | `--ds-color-text` | `#111111` |
| Text muted | `--ds-color-text-muted` | `#333333` |
| Text soft | `--ds-color-text-soft` | `#555555` |
| On primary | `--ds-color-on-primary` | `#fff9f8` |
| Border soft | `--ds-color-border-soft` | `#e7eaf0` |
| Border strong | `--ds-color-border-strong` | `#d4d9e2` |
| Error bg | `--ds-color-status-error-bg` | `#fff1f2` |
| Error text | `--ds-color-status-error-text` | `#9f1239` |

## `short` Palette (semantic product layer)

| Semantic role (`--landing-*`) | DS token source | Hex |
|---|---|---|
| `--landing-color-primary` | `--ds-color-primary` | `#c90008` |
| `--landing-color-primary-strong` | `--ds-color-primary-strong` | `#530d10` |
| `--landing-color-accent` | `--ds-color-product-short-accent` | `#e87d73` |
| `--landing-color-accent-soft` | `--ds-color-product-short-accent-soft` | `#e87d73` |
| `--landing-color-hero-title` | `--ds-color-product-short-accent` | `#e87d73` |
| `--landing-color-price-old` | `--ds-color-product-short-price-old` | `#7f7f7f` |
| `--landing-color-price-old-strike` | `--ds-color-product-short-price-old` | `#7f7f7f` |
| `--landing-color-state-info-bg` | `--ds-color-product-short-surface-quote` | `#f8f6f1` |
| `--landing-color-state-info-text` | `--ds-color-product-short-text-info` | `#3b3b3b` |
| `--landing-color-surface-base` | `--ds-color-bg-canvas` | `#fffdf7` |
| `--landing-color-surface-muted` | `--ds-color-product-bg-soft-peach` | `#ffdfdc` |
| `--landing-color-surface-card` | `--ds-color-product-bg-card` | `#fff7f1` |
| `--landing-color-surface-chip` | `--ds-color-product-short-surface-note` | `#fef5ea` |
| `--landing-color-surface-chip-soft` | `--ds-color-product-short-surface-quote` | `#fffaf2` |
| `--landing-color-surface-accent-soft` | `--ds-color-product-bg-soft-peach` | `#ffdfdc` |
| `--landing-color-surface-warm` | `--ds-color-product-short-surface-warm` | `#fef8ef` |
| `--landing-color-surface-warm-strong` | `--ds-color-product-short-surface-warm-strong` | `#fff8bd` |
| `--landing-color-surface-warm-soft` | `--ds-color-product-short-surface-warm-soft` | `#fff3ec` |
| `--landing-color-surface-badge` | `--ds-color-product-short-surface-badge` | `#fefbbd` |
| `--landing-color-badge-text` | `--ds-color-product-text-badge` | `#f58220` |
| `--landing-color-border-chip` | `--ds-color-product-short-border-soft` | `#ddd8cf` |
| `--landing-color-border-note` | `--ds-color-product-short-border-note` | `#e6d4bf` |

## `irem` Palette (semantic product layer)

| Semantic role (`--landing-*`) | DS token source | Hex |
|---|---|---|
| `--landing-color-primary` | `--ds-color-accent` | `#747ab1` |
| `--landing-color-primary-strong` | `--ds-color-accent` | `#747ab1` |
| `--landing-color-accent` | `--ds-color-accent-strong` | `#dd6d0c` |
| `--landing-color-hero-title` | `--ds-color-accent` | `#747ab1` |
| `--landing-color-state-warning-bg` | `--ds-color-product-bg-badge` | `#fef3c7` |
| `--landing-color-state-warning-text` | `--ds-color-product-irem-warning-text` | `#d97706` |
| `--landing-color-state-info-bg` | `--ds-color-status-info-bg` | `#f3f6ff` |
| `--landing-color-state-info-text` | `--ds-color-status-info-text` | `#384a77` |
| `--landing-color-surface-base` | `--ds-color-bg-canvas` | `#fffdf7` |
| `--landing-color-surface-muted` | `--ds-color-product-irem-surface-chip-soft` | `#f3f6ff` |
| `--landing-color-surface-chip` | `--ds-color-product-bg-warm` | `#eaf4ff` |
| `--landing-color-surface-chip-soft` | `--ds-color-product-irem-surface-chip-soft` | `#f3f6ff` |
| `--landing-color-surface-card` | `--ds-color-surface` | `#ffffff` |
| `--landing-color-surface-badge` | `--ds-color-product-bg-badge` | `#fef3c7` |
| `--landing-color-border-soft` | `--ds-color-product-irem-border-soft` | `#cedbfd` |
| `--landing-color-border-strong` | `--ds-color-product-irem-border-strong` | `#b7c6ea` |
| `--landing-color-border-chip-soft` | `--ds-color-product-irem-border-chip-soft` | `#dbe3ff` |
| `--landing-color-border-subtle` | `--ds-color-product-irem-border-subtle` | `#e5e7eb` |
| `--landing-color-text-chip` | `--ds-color-status-info-text` | `#384a77` |
| `--landing-color-text-strong` | `--ds-color-text-strong` | `#111111` |

## Notes

- Component rules for `short/irem` consume semantic `--landing-*` colors only.
- Product identity differences are expected and allowed only through bridge-level semantic overrides.
- Raw color refs (`legacy/color/ref/product`) are blocked in product component rules by `scripts/guard-ds-contract.mjs`.

## Current DS Principles

Current semantic DS logic is already consistent with the broader CenterWay canon:

1. `structure first, accent second`
2. `surface calm, route visible, trust readable`
3. colors map through `role -> semantic token -> component`, never directly by taste
4. product identity is allowed only as a semantic override, not as an ad hoc local palette

In practice this means:

- `surface-base` carries the emotional climate of the route
- `surface-card` should feel like a close sibling of that base, not an unrelated white slab
- `accent` exists to mark route, highlight, CTA, and numbered emphasis
- `trust/info` colors must feel cooler or more structural than route warmth
- `warning/error` must remain ethical and bounded, not louder than the route accent

## Harmony Formula

### 1. Palette architecture

Each landing palette should be built from exactly 5 layers:

| Layer | Purpose | Typical semantic tokens |
|---|---|---|
| `foundation` | emotional field / page climate | `surface-base`, `surface-muted` |
| `surface` | content carriers | `surface-card`, `surface-elevated`, `surface-chip` |
| `ink` | reading hierarchy | `text`, `text-muted`, `text-soft`, `heading` |
| `route` | decision and pathway | `primary`, `primary-strong`, `accent`, `accent-soft` |
| `trust` | proof / info / status | `state-info-*`, borders, note surfaces |

If a color cannot be assigned to one of these 5 layers, it usually should not exist.

### 2. Surface harmony rule

For landings, `surface-card` must be derived from the route climate, not from generic pure white by default.

Practical rule:

- if `surface-base` is warm off-white, `surface-card` should be warm-leaning neutral
- if `surface-base` is cool mist, `surface-card` should be cool-leaning neutral
- pure white is reserved for:
  - modal/dialog critical separation
  - utility/legal content where neutrality matters more than atmosphere
  - very strong proof contrast only when justified

This is the main reason `short` currently feels slightly off: the card white can read cleaner/brighter than the surrounding warm field and therefore breaks tonal continuity.

### 3. Accent economy rule

One product route should have:

- one `primary`
- one `accent`
- one `accent-soft`

Everything else must be a semantic derivative, not a new hue family.

For example:

- CTA background -> `primary`
- highlighted numbers / hero accent / price emphasis -> `accent`
- soft chips / soft attention backgrounds -> `accent-soft`

If two different oranges/pinks/peaches appear without distinct semantic roles, the palette is drifting.

### 4. Temperature balance rule

Each product should have a dominant temperature and one counterweight:

- `short`: warm route + neutral/trust counterweight
- `irem`: cool route + warm decision/accent counterweight

Rule:

- `foundation + surface` share the dominant temperature
- `trust` leans slightly away from the route for readable structure
- `accent` may be warmer/stronger, but cannot overpower `ink`

### 5. Contrast distribution rule

Use contrast in descending order:

1. `text / heading`
2. `primary CTA`
3. `accent emphasis`
4. `surface separation`
5. `borders`

If a card background or soft chip competes with CTA or heading contrast, the palette hierarchy is wrong.

### 6. Surface-shadow coupling rule

Surface and shadow must read as one material system:

- warm surfaces -> warmer, softer shadows
- cool surfaces -> cleaner, mineral shadows
- one product should not mix visibly different shadow temperatures for the same card family

### 7. White control rule

`White` is not a neutral by default inside CenterWay landings.

Use it only if it passes 3 checks:

1. it does not look colder than the route field
2. it does not visually jump harder than CTA/accent
3. it does not make neighboring warm/cool surfaces look dirty

If any of these fail, use a softened card neutral instead of pure white.

## Universal Construction Algorithm

This is the practical way to assemble a product gamma inside the semantic DS.

### Step 1. Choose the route anchor

Start from one route hue only:

- `short` route anchor = deep red + peach support
- `irem` route anchor = muted periwinkle + warm orange support

Rule:

- `primary` is the decisive action color
- `accent` is the narrative emphasis color
- these two may differ, but they must still belong to one route family, not two unrelated brands

### Step 2. Choose the page climate first, not the card color

Before touching any card token, define:

- `surface-base`
- `surface-muted`

Formula:

- `surface-base` = the calmest readable atmospheric neutral for the route
- `surface-muted` = one semantic step closer to the route climate than `surface-base`

Practical examples:

- warm route -> `base` warm bone, `muted` warm blush/oat
- cool route -> `base` mineral off-white, `muted` pale mist/periwinkle fog

### Step 3. Derive card neutral from base, not from browser white

Formula:

- `surface-card = midpoint(surface-base, neutral-white)` but biased toward `surface-base`

Practical interpretation:

- card should be 1 semantic step cleaner than `surface-base`
- card should not jump into a new temperature family

In practice:

- warm base -> warm near-white card
- cool base -> cool near-white card

If `surface-card` feels like a different product theme, it is too far from `surface-base`.

### Step 4. Build trust as a counterweight, not as a second accent

Formula:

- `trust family = low-saturation counter-temperature to the route family`

Meaning:

- warm route uses slightly cooler or mineral trust
- cool route uses slightly warmer or mineral trust
- trust must be quieter than accent

Trust palette should define:

- `state-info-bg`
- `state-info-text`
- `border-soft` or `border-chip`

### Step 5. Build soft attention from the accent, not from a new hue

Formula:

- `accent-soft = accent with strongly reduced saturation and increased lightness`

Meaning:

- it should feel like a whisper of the same route/emphasis hue
- it cannot become a second independent pastel family

Use cases:

- numbers
- small emphasis chips
- soft highlight backgrounds

### Step 6. Separate note/warm surfaces from trust surfaces

Formula:

- `note/warm surfaces` belong to embodiment/care
- `trust/info surfaces` belong to proof/structure

They must never collapse into one visual bucket.

If users cannot tell:

- “this is explanatory/proof”
from
- “this is warm supportive emphasis”

the gamma is underspecified.

## Universal Numeric Heuristics

These are practical heuristics, not absolute science, but they are stable enough for gating.

### 1. Surface distance rule

Between:

- `surface-base`
- `surface-card`
- `surface-muted`

there should be visible but soft separation.

Heuristic:

- each adjacent pair differs by about one semantic step of lightness
- no pair should look either identical or brutally separated

Operationally:

- if you blur the screen and cards disappear into base, the distance is too small
- if cards look pasted from another website, the distance is too large

### 2. Saturation rule

For large surfaces:

- saturation must always be lower than route accent saturation

If a large background is as saturated as accent, it is no longer a surface, it is a banner.

### 3. Route hierarchy rule

Within route colors:

- `primary` = highest action gravity
- `accent` = lower than primary in action gravity, but high in narrative visibility
- `accent-soft` = low gravity, high coherence

So:

- `primary` should win against `accent`
- `accent` should win against `surface`
- `accent-soft` should never beat `text`

### 4. Text immunity rule

No product gamma may lower text clarity to preserve mood.

If a palette choice forces text to become lighter/greyer just to “fit the atmosphere”, reject it.

### 5. Temperature continuity rule

At screen level, count the dominant temperature reads:

- warm
- cool
- neutral-mineral

A page should read as:

- one dominant temperature
- one controlled counterweight
- one neutral reading layer

If it reads as multiple competing climates, reject.

## Concrete Construction Formulas

These formulas are the most useful practical shortcuts.

### Formula A. Warm product

Use when the route is body-first, calming, embodied.

Build like this:

1. choose warm route accent
2. set `surface-base` to warm off-white
3. set `surface-muted` to warm blush/oat
4. set `surface-card` to warm near-white
5. set `trust` to mineral-neutral or very lightly cooled warm-neutral
6. set `note/warm` to slightly richer warm cream
7. keep `primary` deeper and denser than all warm surfaces

This is the correct formula for `short`.

### Formula B. Cool product

Use when the route is structured, precise, more methodical.

Build like this:

1. choose cool route primary
2. set `surface-base` to off-white/mineral
3. set `surface-muted` to pale mist with route tint
4. set `surface-card` to clean cool near-white
5. set `trust` to cool blue-grey
6. set `accent` as the warm counterweight for decisions or highlights
7. keep large warm surfaces minimal

This is the correct formula for `irem`.

### Formula C. Card decision

When deciding whether a card should be white, tinted, or trust-colored:

1. Is it just content carrier? -> `surface-card`
2. Is it explanatory/proof/trust? -> `state-info-bg` or trust card
3. Is it warm supportive note? -> note/warm surface
4. Is it promotional/decision? -> keep card neutral; use accent inside, not as full surface by default

## Gates For Palette Construction

### Construction Gate 1. Origin traceability

For every visible product color, you must be able to answer:

`which layer generated it?`

Allowed answers:

- foundation
- surface
- ink
- route
- trust

If the answer is “we just needed a nicer shade”, reject.

### Construction Gate 2. Derivation traceability

For every derivative token, you must be able to answer:

`derived from what?`

Examples:

- `surface-card` derived from `surface-base`
- `accent-soft` derived from `accent`
- `trust border` derived from `trust bg`

If a derivative token has no parent logic, reject.

### Construction Gate 3. Temperature audit

Ask:

1. what is the dominant page temperature?
2. what is the counterweight?
3. what is the neutral layer?

If you cannot answer all three in one sentence, the gamma is not stable enough.

### Construction Gate 4. Surface bucket audit

Every block on a landing must belong to one of these buckets:

- neutral card
- trust card
- warm note/accent-soft card
- ambient section field

If a block does not clearly belong to one bucket, it is probably using the wrong surface token.

### Construction Gate 5. Action priority audit

Blur-test the screen mentally:

- CTA must still be first
- heading/text must still structure reading
- accents may support rhythm
- surfaces must stay background actors

If surfaces win the blur-test, reject.

## Product Formulas

### `short`

Target formula:

- dominant mood: warm reset / embodied softness
- base: warm off-white
- card: warm near-white, slightly softened
- accent: peach-coral
- primary: deep route red
- trust/info: warm-neutral or lightly mineral, never saturated blue

Meaning:

- the page should feel warm and embodied first
- route red should feel like decision energy
- peach should feel like therapeutic emphasis, not like a second CTA color
- cards should feel like part of the warm field, not inserted white boards

### `irem`

Target formula:

- dominant mood: structured cool calm
- base: cool off-white / pale mist
- card: clean but slightly cooled surface
- primary: muted periwinkle-violet
- accent: warm orange route support
- trust/info: cool structural blue-grey

Meaning:

- the page should feel organized and methodical first
- warm accent should energize decisions, not recolor the whole route

## Palette Gates

Every product palette change should pass these gates.

### Gate 1. Role completeness

Must have explicit semantic tokens for:

- `surface-base`
- `surface-muted`
- `surface-card`
- `text`
- `text-muted`
- `heading`
- `primary`
- `primary-strong`
- `accent`
- `accent-soft`
- `state-info-bg`
- `state-info-text`
- `border-soft`

No undefined semantic role may be filled ad hoc in component CSS.

### Gate 2. Hue budget

Per product:

- max 1 dominant route hue family
- max 1 support accent hue family
- max 1 trust hue family

If the screen visually reads as 4+ unrelated hue families, reject.

### Gate 3. Surface continuity

Across the landing, all content cards must belong to one of these buckets only:

- `card-neutral`
- `card-soft-accent`
- `card-trust`

If two cards of the same family use different background logic without semantic reason, reject.

### Gate 4. White restraint

Reject if:

- `surface-card` feels visually brighter than the route climate by more than one semantic step
- large white cards sit on warm/cool tinted fields and look cut out from another theme

### Gate 5. Accent discipline

Reject if:

- accent is used simultaneously for route, warning, badge, chip, and trust
- accent-soft becomes a second unrelated pastel

### Gate 6. Trust separation

Info/proof surfaces must be distinguishable from route accent surfaces.

Reject if:

- proof/info cards look like promotional highlight cards
- users cannot visually separate `method` from `promotion`

### Gate 7. Cross-section rhythm

Reject if:

- one section uses bright white cards, the next uses tinted cards, the next uses warm cards, with no semantic pattern
- section background transitions create a new palette family instead of modulating the same one

### Gate 8. Interaction priority

Reject if:

- card surfaces attract more attention than CTA
- soft badges compete with price/CTA emphasis
- borders/shadows become stronger than text hierarchy

## Practical Review Checklist

Before accepting a palette adjustment, check:

1. Does the page read as one temperature family with one counterweight?
2. Does `surface-card` belong to the same atmosphere as `surface-base`?
3. Is there exactly one decision color and one emphasis color?
4. Are trust/info blocks visually separable from promotional emphasis?
5. Are card families consistent across sections?
6. Does white behave like a controlled material, not a default browser blank?

## Card Category Tokens

For landing implementation, card families must be explicitly assigned to semantic category tokens:

| Category | Token | Meaning |
|---|---|---|
| `neutral card` | `--landing-color-card-neutral` | default content carrier for regular content cards |
| `trust card` | `--landing-color-card-trust` | proof / FAQ / guarantee / explanatory trust blocks |
| `note card` | `--landing-color-card-note` | warm supportive note / reminder |
| `accent pill` | `--landing-color-surface-accent-soft` | soft numbered badges / chips / small emphasis pills |
| `decision` | `--landing-color-primary` | CTA/action only, never whole large card surfaces |

Important:

- categories must exist even if two of them currently map to the same visible surface
- category identity is semantic first, visual differentiation second
- width families should be equally explicit where needed, for example `stack-card` for `why / faq / guarantee`
- if a section resolves to one large card carrier, its section title should live inside that card, not as a detached heading above it
- for `short`, the recommended large-card harmony is:
  - `neutral card` = warm near-white carrier
  - `trust card` = same carrier as neutral by default, trust expressed through icon/border/content role rather than a colder fill
  - `note card` = warmer supportive fill, only for compact note blocks
- for `short`, `guarantee`, `why`, and `faq` belong to one `trust + stack-card` family and should share:
  - one `max-width`
  - one inset contract
  - one surface family

## Immediate Implication For `short`

The next palette pass for `short` should likely focus on:

1. softening `surface-card` away from stark white toward the warm field
2. reducing accidental hue drift between peach, warm note, and white surfaces
3. keeping red as the only true decision color
4. making quote/info/proof surfaces structurally distinct from promo/attention surfaces

This is the right next move before any further fine visual tuning.

## Recommended `short` Gamma Matrix

Target semantic role: warm restorative landing with one strong decision color and one calm trust counter-surface.

### Target palette buckets

| Bucket | Semantic token | Recommended role | Current direction |
|---|---|---|---|
| `base` | `--landing-color-surface-base` | page climate / quiet reading field | keep warm bone |
| `muted` | `--landing-color-surface-muted` | section transition / soft zone backgrounds | keep warm peach blush |
| `neutral card` | `--landing-color-card-neutral` | default large content cards | warm near-white |
| `trust card` | `--landing-color-card-trust` | proof / FAQ / why-it-works / offer | slightly more mineral warm-neutral than neutral card |
| `note` | `--landing-color-card-note` | compact supportive note blocks only | warm cream |
| `accent soft` | `--landing-color-surface-accent-soft` | numbered circles / soft chips / small emphasis pills | peach-soft |
| `accent` | `--landing-color-accent` | hero emphasis / price emphasis / numbered markers | coral |
| `decision` | `--landing-color-primary` | CTA only | strong red |

### Block-to-token assignment

| Block family | Recommended surface token | Notes |
|---|---|---|
| `problem cards` | `--landing-color-card-neutral` | regular carrier, no extra emotional hue |
| `solution cards` | `--landing-color-card-neutral` | icon tile can stay warmer than the card |
| `program cards` | `--landing-color-card-neutral` | lesson pill may stay accent-soft |
| `format` single-card block | `--landing-color-card-neutral` | title inside the card |
| `why it works` | `--landing-color-card-trust` | belongs to trust + stack-card family |
| `FAQ` accordion cards | `--landing-color-card-trust` | same family as `why it works` |
| `proof/reviews` | `--landing-color-card-trust` | trust-first, not promo |
| `offer` | `--landing-color-card-trust` | trust + decision composition, not a promo-colored slab |
| `hero note/quote` | `--landing-color-state-info-bg` or trust family | more structural than promo |
| `compact reminders` | `--landing-color-card-note` | only compact note surfaces |

### Harmony rules for `short`

1. `Decision` must remain unique.
Only CTA backgrounds use `--landing-color-primary`.

2. `Accent` must stay narrative, not structural.
Use `--landing-color-accent` for title/price emphasis, not for large card fills.

3. `Trust` must be calmer than `neutral`, but not colder than the route.
Recommended direction: stone-ivory / mineral warm-neutral, not blue.

4. `Note` must be warmer than card, but smaller in scope.
If a block is large, it should not use the note surface.

5. `Base -> muted -> card -> trust` should feel like one material ladder.
No jump from warm field to stark white slab.

### Recommended next palette move

The strongest next improvement for `short` is not a new accent hue, but a slight trust separation:

- keep `neutral card` on the current warm near-white
- move `trust card` one subtle step toward mineral warm-neutral
- keep `note` warmer than both

Current trial mapping for this pass:

- `neutral card` -> `--landing-color-surface-card`
- `trust card` -> `--landing-color-state-info-bg`
- `note card` -> `--landing-color-surface-warm-soft`

That gives `short` a clearer harmonic law:

- warm atmospheric field
- warm neutral carrier
- restrained trust counter-surface
- coral narrative accent
- red decision endpoint
