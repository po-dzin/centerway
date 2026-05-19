# Platform Refactor Wave 2026-05-18

## Scope

First refactor wave for the current platform state focuses on shell architecture, not route semantics.

- surface: `platform hub / platform routes`
- semantic role: `orientation + route`
- user question: `where am I, how do I navigate, how do I open profile/help`
- token source: `global app DS`
- content source: `canon + src/lib/platform/content`
- route boundary: `platform routes`

## Why This Slice

Current platform shell behavior is concentrated in `src/components/platform/PlatformLayout.tsx`.
That file mixes:

- header tone detection;
- auth/profile state;
- menu state and body lock;
- footer rendering;
- shell composition.

This makes platform shell work harder to reason about and raises the cost of later semantic/UI refactors.

## Wave 1 Goal

Split shell concerns into explicit modules without changing:

- route boundaries;
- content structure;
- CTA hierarchy;
- token contracts;
- public behavior.

## Planned Result

- `PlatformLayout.tsx` becomes a thin shell entrypoint.
- header tone logic moves into a dedicated layout helper.
- profile/auth UI moves into a dedicated layout component.
- header and footer become independent layout modules.

## Wave 2

Second refactor slice keeps the same public semantics for platform blocks and legal content pages, but removes the all-purpose style import pattern.

- `PlatformShellStyles.ts` becomes the explicit entrypoint for shell/header/footer/profile consumers.
- `PlatformContentStyles.ts` becomes the explicit entrypoint for platform blocks, legal content pages, and form consumers.
- block/page consumers stop depending on the legacy all-in-one `PlatformStyles` entrypoint.

## Wave 3

Third refactor slice splits the old monolithic block stylesheet into semantic families while preserving the same block contracts and token usage.

- `PlatformBlocksBase.module.css` for shared block typography and neutral layout primitives.
- `PlatformBlocksOrientation.module.css` for hero, intro, video, and media-led orientation surfaces.
- `PlatformBlocksOffer.module.css` for program catalog, offer visuals, and offer-detail surfaces.
- `PlatformBlocksRoute.module.css` for route-choice and wayfinding surfaces.
- `PlatformBlocksTrust.module.css` for proof, support, author, policy, and care surfaces.
- `PlatformBlocks.module.css` remains only as a compatibility note and is no longer a live runtime source.

## Wave 4

Fourth refactor slice aligns the block file tree with semantic families without changing registry keys or route/runtime contracts.

- `blocks/orientation/**` owns hero and intro orientation surfaces.
- `blocks/offer/**` owns catalog and offer-detail surfaces.
- `blocks/trust/**` owns expert, proof, support, and boundary surfaces.
- `blocks/route/**` owns route context helpers and next-step surfaces.
- `blocks/registry.ts` keeps the same public variant map while importing from the semantic tree.

## Wave 5

Fifth refactor slice shortens variant and module names to a plain operational vocabulary.

- `home.*` -> `hub.*`
- `offer.details` -> `offer.info`
- `offer.support` -> `offer.form`
- `next-step` -> `next`

Names kept unchanged because they are already short and clear:

- `expert.*`
- `offer.hero`
- `support.form`
- `boundary`

## Out Of Scope

- redesign of header/footer;
- route IA changes;
- manifest/block rewrites;
- token renaming;
- landing parity work.
