# Landing Size Policy (`short` / `irem`)

Scope date: 2026-04-25  
Authority: local implementation policy, derived from `DS base + landing bridge + product overrides`.

## Goal

Unify landing blocks by **semantic size role**, not by arbitrary equal-height rules.

The failure mode we hit in `short` was forcing different card families into one height system. That created visible empty tails in compact cards and made content feel vertically disconnected.

## Core Rule

For landing UI, the default order of size decisions is:

1. `role`
2. `width / max-width`
3. `padding`
4. `media slot`
5. `gap`
6. `height` only if the family is truly parallel

Height is the last lever, not the first one.

## Card Families

| Family | Meaning | Width policy | Height policy | Examples |
|---|---|---|---|---|
| `compact-info-card` | short explanatory/support card | grid/flex width | intrinsic | `short` solution cards |
| `feature-grid-card` | parallel symptom/problem cards | equal column width | intrinsic | `short` problem cards |
| `list-program-card` | lesson/program cards with media + list | equal column width | intrinsic by default | `short` program cards |
| `summary-card` | one large explanatory/list card | constrained max-width | intrinsic | `short` format card |
| `media-tile` | proof/testimonial screenshot tile | fixed width or aspect ratio | media-driven | `short` review screenshots |
| `media-frame` | embedded video/media frame | constrained max-width | aspect/media-driven | `short` proof video, hero video |
| `decision-card` | guarantee / offer / next-step container | constrained max-width | intrinsic | `short` offer card |
| `paired-composition` | left media + right text as one composition | constrained widths per side | paired min-height allowed | `short` expert block |

## Global Policy

### 1. Intrinsic height is default

Use intrinsic height for:

- compact info cards
- feature grid cards
- list/program cards
- summary cards
- decision cards

Do not equalize these by height unless copy density is tightly controlled and semantically parallel.

### 2. Equal height is exceptional

Allow equal/min-height only for:

- strict media tiles
- paired compositions where both sides form one object

Even there, prefer:

- fixed media slot
- aligned internal padding
- stable row rhythm

before adding more height constraints.

### 3. Width is the main unifier

For most landing card families, the right visual consistency comes from:

- equal width
- equal padding
- equal media slot proportions
- equal radius/shadow/surface

not from equal height.

### 4. Media objects are separate from cards

Media should use:

- one semantic radius family
- one aspect/max-width policy

But media containers should not automatically inherit card behavior unless the entire block is semantically a card.

### 5. Composition blocks are not generic cards

`expert`-style blocks are paired compositions:

- media side
- text side

They may share composition-level balance rules, but should not leak those rules into small cards elsewhere.

## Token Roles

Bridge-level semantic size roles:

- `--landing-size-card-compact-min-height`
- `--landing-size-card-feature-min-height`
- `--landing-size-card-list-min-height`
- `--landing-size-section-reading-max-width`
- `--landing-size-section-stack-max-width`
- `--landing-size-section-shell-max-width`
- `--landing-size-card-summary-max-width`
- `--landing-size-card-media-tile-width`
- `--landing-size-card-media-frame-max-width`
- `--landing-size-card-decision-max-width`
- `--landing-size-card-composition-media-max-width`
- `--landing-size-card-composition-min-height`

Important:

- `compact / feature / list` families default to `auto`
- `section-reading` is for text measures like section intros, proof copy, guarantee copy
- `section-stack` is for single-card explanatory blocks and accordion stacks
- `section-shell` is for full section content width, grids, and paired compositions
- product overrides may opt into non-auto values, but only with explicit justification

## Applied Rule For `short`

Current `short` policy after cleanup:

- solution cards → `compact-info-card` → intrinsic height
- problem cards → `feature-grid-card` → intrinsic height
- program cards → `list-program-card` → intrinsic height
- format card → `summary-card`
- proof screenshots → `media-tile`
- proof video → `media-frame`
- offer block → `decision-card`
- expert block → `paired-composition`

## Anti-Patterns

Do not:

- add `min-height` to all cards “for neatness”
- use one height token for unrelated card families
- equalize text cards by height when copy length is product-dependent
- solve composition imbalance by scaling/cropping random media assets first

## Validation

Visual checks:

- compact cards do not have large empty tails
- parallel cards align by width/padding/media slot, not fake height
- paired compositions feel balanced on desktop/tablet and natural on mobile

Contract gate:

- `node scripts/guard-ds-contract.mjs`
