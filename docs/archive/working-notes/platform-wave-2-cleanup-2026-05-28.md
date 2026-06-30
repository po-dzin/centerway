# Platform Wave 2 Cleanup — 2026-05-28

## Scope

Wave 2 closes the remaining public-platform cleanup after the route canon and shared surface rollout.

This pass targets:

- narrower style entrypoints instead of one broad compatibility facade;
- removal of public filler / migration copy from platform-facing surfaces;
- cleanup of public route exposure for internal migration surfaces;
- reduction of structural noise inside the profile surface;
- elimination of residual raw-color literals in the active platform UI path.

## Implemented

### Style API narrowing

The broad `PlatformContentStyles.ts` compatibility facade was removed from active use.

New merged style entrypoints:

- `src/components/platform/PlatformSurfaceStyles.ts`
- `src/components/platform/PlatformHeroStyles.ts`
- `src/components/platform/PlatformOfferStyles.ts`
- `src/components/platform/PlatformRouteStyles.ts`
- `src/components/platform/PlatformTrustStyles.ts`

These keep responsive co-classes intact but narrow consumption by semantic area instead of one repo-wide namespace.

### Public copy cleanup

Public platform copy was hardened to remove obvious filler / ops-language:

- `/products` fallback no longer tells the user to “come back later”;
- `/profile` auth / progress / access states no longer say “here will be…” or expose implementation-state wording;
- `/api/platform/users/me/profile` progress note was aligned with the same public-language contract.

### Route cleanup

`/platform-vision` is no longer treated as an ordinary public platform surface.

Current behavior:

- `src/app/(platform)/platform-vision/page.tsx` redirects to `/`

The old `PlatformVisionPage` residue has been removed from the active component tree, so `/platform-vision` now exists only as a redirecting route boundary.

### Profile structure

`src/components/platform/UserProfilePageClient.tsx` was reduced from the previous monolithic state by moving:

- profile types to `src/components/platform/profile/types.ts`
- profile copy to `src/components/platform/profile/copy.ts`

This keeps the client surface focused on auth/session/runtime logic rather than holding the full copy layer inline.

### Token / color cleanup

Residual raw color literals were removed from the active platform path where they were still used in shell/component recipes:

- `src/components/platform/PlatformShell.module.css`
- `src/components/platform/PlatformComponents.module.css`

## Verification

Validated on this pass:

- `npm run lint`
- `npm run build`
- `npm run generator:validate`
- `npm run canon:guard`
- `npm run semantic:audit`
- `npm run guard:ds-contract`
- `npm run smoke:platform:browser`

## Remaining caveat

The current worktree still contains unrelated user-local doc deletions outside this wave. Wave 2 code cleanup should be reviewed independently from that external doc-state drift.
