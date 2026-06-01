# Platform Runtime Boundary

Date: 2026-05-24
Status: local operational contract

## Rule

Public platform pages are now typed React templates.

Generator runtime is reserved for:

- branded funnel entry surfaces that still need fast assembly or experiment switching;
- funnel support / utility pages tied to those branded surfaces when the product is explicitly enabled for that branch;
- lesson-pilot while it remains in generator scope.

Generator runtime is no longer the source of truth for:

- `/`
- `/expert`
- `/dosha-test`
- `/consult`
- `/programs/*`
- `/products/*`
- public alias entry routes such as `/detox`, `/herbs`, `/mini-detox`

## Public platform ownership

Platform-owned public templates live in typed components and shared page shells:

- `src/components/platform/PlatformStandalonePages.tsx`
- `src/components/platform/PlatformCatalogPages.tsx`
- `src/components/platform/PlatformOfferSurfaceTemplate.tsx`
- `src/components/platform/PlatformLegalTemplate.tsx`

Route files should stay thin and delegate page assembly to shared platform templates or semantic sections. `PlatformContentStyles.ts` remains a transitional implementation detail behind those shared components, not a page-authoring surface.

## Funnel ownership

Generator-owned routes are now limited to:

- `consult`
- `detox`
- `herbs`
- `lesson-pilot`

Generated funnels enter through internal routes:

- `/funnel-entry/consult`
- `/funnel-entry/detox`
- `/funnel-entry/herbs`

Branded hosts rewrite to these internal routes through proxy logic. Public main-domain routes do not.

Generated funnel utility/support pages are enabled in Wave 1 only for:

- `consult`
- `detox`

`herbs` keeps its generated funnel entry but does not expose shared utility pages in this wave.

## Alias policy

Public alias routes collapse into canonical platform IA:

- `/detox` -> `/programs/way21`
- `/programs/detox` -> `/programs/way21`
- `/herbs` -> `/products/herbs`
- `/mini-detox` -> `/programs/mini-detox`

Canonical public detox ownership lives on:

- `/programs/way21`

If a branded host still needs its own root surface, proxy must rewrite it intentionally instead of sharing the public platform route key.

## Simplification policy

Do not add new `platform.block`-style manifest assembly for public platform pages.

If a new platform page is needed:

1. compose it from typed platform sections;
2. keep it inside the platform shell and DS token contract;
3. use generator only if the page is truly a funnel/landing surface that benefits from experiment/runtime assembly.
