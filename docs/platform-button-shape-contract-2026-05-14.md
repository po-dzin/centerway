# Platform Button Shape Contract — 2026-05-14

Surface: `platform routes`

Semantic role: `route / offer / support actions`

User question: `what is the main action here and does it belong to the same platform system?`

Token source: `global DS token`

Content source: `existing platform CTA surfaces`

Route boundary: `platform route only`

## Decision

Main platform CTA surfaces use one shared button-shape token:

- `--ds-radius-button-soft: 1rem`

This token now feeds:

- `--cw-radius-btn`
- platform `primaryButton`
- platform `secondaryButton`
- platform `ghostButton`
- hero primary / secondary CTA
- program card CTA links

## Rationale

- The platform needs one durable CTA geometry across home, expert, program, offer, form, and support surfaces.
- Full pills over-soften the interface and push it toward landing-style wellness decoration.
- A soft rounded rectangle keeps the brand calm, but preserves structure and editorial seriousness.
- Pills remain allowed for compact chips, topbar micro-elements, and non-primary utility surfaces.

## Scope

Applies to main platform page actions, not to:

- topbar icon slots
- chips / badges
- circular icon markers
- legacy funnel surfaces

## Implementation notes

Updated files in this cycle:

- `src/app/globals.css`
- `src/components/platform/PlatformShell.module.css`
- `src/components/platform/PlatformBlocks.module.css`

If this becomes the durable cross-platform rule beyond the current platform surface pass, promote the minimum token-shape rule into RAverse design tokens / UI canon.
