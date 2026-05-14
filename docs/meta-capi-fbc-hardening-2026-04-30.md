# Meta CAPI FBC Hardening 2026-04-30

## Scope

Operational hardening of Meta tracking after Event Manager warnings about invalid `creationTime` and degraded event matching quality.

This is a local implementation note and SQL provenance companion, not a shared canon note.

## Root Causes Closed

1. `fbc` was not treated as a first-class tracking field.
2. Server-side CAPI rebuilt `fbc` from `fbclid + event_time`, which made click identity drift across `ViewContent`, `InitiateCheckout`, and `Purchase`.
3. Static funnel checkout emitted server-side `InitiateCheckout` twice:
   once through `/api/events`, then again through `/api/pay/start`.
4. Admin quality views had no visibility into `fbc`.

## Runtime Contract Now

- Client surfaces read both `_fbp` and `_fbc`.
- `fbc` is forwarded through funnel/client payloads, `pay/start`, `events`, `leads`, and `meta:capi` jobs.
- CAPI prefers explicit `fbc`; only legacy fallback can synthesize from `fbclid`.
- Static landing checkout keeps:
  - browser Pixel `InitiateCheckout`;
  - single server-side `InitiateCheckout` from payment start.
- `Purchase` recovery now reuses tracking context from the prior checkout chain instead of relying only on `orders`.

## Files Touched

- `src/lib/tracking/capi.ts`
- `src/lib/tracking/metaClickIds.ts`
- `src/components/landing/runtime/useLandingAnalytics.ts`
- `src/landing-static/{short,irem}/js/common.js`
- `src/app/api/{events,leads,pay/start,orders/create,wfp/webhook}/**`
- `src/lib/paymentStart.ts`
- `src/app/api/admin/{analytics,system/pulse}/**`
- `docs/migration/sql/2026-03-06_capi_initiate_checkout_backfill.sql`
- `docs/migration/sql/2026-04-30_meta_fbc_hardening.sql`

## Follow-Up

1. Apply `docs/migration/sql/2026-04-30_meta_fbc_hardening.sql` in Supabase when ready.
2. After deploy, validate in Meta Event Manager that:
   - `InitiateCheckout` warning about invalid `creationTime` clears;
   - `fbc` coverage rises;
   - event matching quality for `ViewContent`, `InitiateCheckout`, `Purchase` improves.

## 2026-05-12 Alert Fix

Meta Business Suite still reported invalid `creationTime` for `Purchase`, `ViewContent`, and `InitiateCheckout`.

Root cause in runtime:

- landing runtime reused an existing `_fbc` cookie even when a new landing session arrived with a different `fbclid`
- checkout collection reused raw `fbc` without checking that its embedded click id still matched the current `fbclid`
- server-side fallback trusted direct `fbc` before verifying it against `fbclid`

That produced a stale `fbc` + fresh `fbclid` pair, which Meta interprets as an invalid click creation timeline.

Applied fix:

- client runtime now rebuilds `_fbc` whenever the stored `fbc` belongs to a different `fbclid`
- static short/irem checkout collectors discard mismatched raw `fbc` and rebuild it from the current `fbclid`
- server-side `resolveFbc()` now ignores direct `fbc` when its embedded click id conflicts with the current `fbclid`
- webhook `Purchase` now prefers payment timestamps from webhook payload fields instead of always using webhook receipt time
