# Platform Unification Wave 1

Date: 2026-05-24
Status: implemented

## Semantic contract

- `surface`: public platform offer/index/legal routes plus generated funnel utility surfaces
- `semantic_role`: offer, support, boundary, route-index, legal utility
- `user_question`: where am I, which route is canonical, what is the next safe step
- `token_source`: global app DS tokens from `src/app/globals.css`; generator token packs remain isolated to `/funnel-entry/*`
- `content_source`: `src/lib/platform/content.ts` plus the active CenterWay canon
- `route_boundary`: typed platform routes on the main domain; generated funnels only on internal `/funnel-entry/*`; generated utility pages only for `consult` and `detox`

## Implemented in Wave 1

### 1. Canonical route ownership

- `detox.platformRoute` now resolves to `/programs/way21`
- `/programs/detox` is now a permanent alias redirect to `/programs/way21`
- `/detox` is now a permanent alias redirect to `/programs/way21`
- `/herbs` is now a permanent alias redirect to `/products/herbs`
- sitemap no longer exposes `/programs/detox` or `/herbs`
- semantic audit now validates internal generator ownership on `/funnel-entry/consult`, `/funnel-entry/detox`, `/funnel-entry/herbs`

### 2. Shared platform composition

- shared detail composition introduced in `src/components/platform/PlatformOfferSurfaceTemplate.tsx`
- `consult`, program detail pages, and product detail pages now render through the same hero/detail/support/boundary stack
- shared legal and utility composition introduced in `src/components/platform/PlatformLegalTemplate.tsx`
- `/legal/privacy`, `/legal/public-offer`, and `funnel-support/[product]/[page]` now render through the same DS-backed template layer
- shared catalog composition moved to `src/components/platform/PlatformCatalogPages.tsx`
- home/program catalog cards now standardize on `PlatformOfferCard`

### 3. DS drift closure

- scenic platform card palettes were moved from raw hex in `PlatformBlocksOffer.module.css` to global DS token vars in `src/app/globals.css`
- `npm run canon:guard` is green without adding component-level allowlist exceptions

### 4. Utility surface scope

- generated funnel utility/support pages remain enabled only for `consult` and `detox`
- `herbs` keeps its generated funnel entry route but utility pages intentionally remain closed in Wave 1

## Verification

Required gates passed on 2026-05-24:

- `npm run canon:guard`
- `npm run semantic:audit`
- `npm run guard:ds-contract`
- `npm run generator:validate`
- `npm run lint`
- `npm run build`

Browser smoke:

- added `tests/e2e/platform-unification.spec.ts`
- added `npm run smoke:platform:browser`
- verified `/`, `/consult`, `/programs`, `/programs/way21`, `/programs/detox`, `/products`, `/products/herbs`, `/detox`, `/herbs`, `/legal/privacy`, `/legal/public-offer`, `/funnel-entry/consult`, `/funnel-entry/detox`, `/funnel-support/consult/thanks`, `/funnel-support/detox/public-offer`
- verified `/funnel-support/herbs/thanks` stays closed with `404`
