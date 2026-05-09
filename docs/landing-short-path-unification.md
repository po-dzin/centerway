# Short Path Unification

## Scope

- canonical public landing route: `/short`
- canonical utility routes: `/short/thanks.html`, `/short/public-offer.html`, `/short/pay-failed.html`
- compatibility alias retained: `/reboot/*`

## Current Runtime Contract

- `short` is the canonical public route and product key for the Short Reboot funnel.
- `reboot` remains a backward-compatible alias at the route layer.
- static source files stay in `src/landing-static/short/**`.
- static asset serving maps alias prefix `reboot` to source directory `short`.

## Why

- `short` matches the historical funnel contract, tracking payloads, offer ids, and local source tree
- route health and smoke checks no longer need to treat `reboot` as the primary path
- old `reboot` links keep working while external traffic is cleaned up gradually

## Guardrails

- do not remove `/reboot/*` until traffic, ads, and external links are confirmed clean
- smoke coverage must validate both:
  - canonical `/short/*`
  - alias `/reboot/*`

## Files Owning The Contract

- `src/lib/landing/config.ts`
- `src/lib/landing/contracts.ts`
- `src/lib/staticAssets/serve.ts`
- `src/app/[brand]/[...path]/route.ts`
- `scripts/smoke-landing-next-contract.mjs`
- `scripts/smoke-landing-cutover-toggle.mjs`
