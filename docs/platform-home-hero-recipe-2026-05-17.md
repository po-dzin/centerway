# Platform Home Hero Recipe — 2026-05-17

## Scope

Public platform home hero `/`.

## Semantic Contract

- `surface`: platform hub
- `semantic_role`: orientation + route entry
- `user_question`: where am I, what is this space, and what is the first next step
- `token_source`: global DS tokens + platform block recipes
- `route_boundary`: platform route

## Current Rule

The home hero is a `sanctuary + guide` entry surface with one content column and one photographic atmosphere layer.

Its job is:

- establish CenterWay as the platform center of gravity
- provide one calm primary route action
- keep the expert image present as trust atmosphere, not as a competing promo card

## Structural Rule

- one hero section
- one photographic layer
- one text column
- one primary CTA
- no competing secondary CTA in the first screen slice

Current structure:

- eyebrow
- H1
- lead
- primary CTA

## Framing Rule

The expert image is not framed from the top edge.

It is framed from a subject-centered crop:

- desktop uses centered transform logic
- tablet uses centered transform logic
- mobile uses top-biased crop with a lighter transform

Current implementation:

- desktop: `src/components/platform/PlatformBlocks.module.css:68`
- mobile: `src/components/platform/PlatformResponsive.module.css:641`
- tablet: `src/components/platform/PlatformResponsive.module.css:815`

Framing is controlled through one recipe family:

- `--cw-hero-photo-x`
- `--cw-hero-photo-y`
- `--cw-hero-photo-shift-y`
- `--cw-hero-photo-scale`
- `--cw-hero-photo-origin`

## Overlay Rule

Text readability is protected by the hero overlay, not by adding extra cards or local background patches behind the headline.

The overlay must:

- darken the left text zone more strongly than the right image zone
- preserve visibility of the subject
- keep the first screen atmospheric, not posterized

Current overlay source:

- `src/components/platform/PlatformBlocks.module.css:49`

## Composition Rule

- the text column remains left-anchored
- the image remains atmospheric support, not the primary information carrier
- the face should stay visible, but should not sit under the headline mass
- hero balance should be adjusted by crop/transform first, not by introducing new decorative surfaces

## Stability Rule

Before changing this hero again:

1. decide which breakpoint is actually wrong;
2. change only that breakpoint recipe first;
3. avoid mixing multiple reframing strategies at once without reason;
4. keep `overflow: hidden` on the photo layer;
5. validate against desktop, tablet, and mobile separately.

## Canon Promotion Status

Local only for now.

Promote only after:

- the framing stabilizes across desktop / tablet / mobile
- the same hero logic is reused or becomes the durable platform-hub rule
