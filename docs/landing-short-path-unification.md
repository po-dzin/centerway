# Short Path Unification

## Scope

- canonical public landing route: `/reboot`
- canonical utility routes: `/reboot/thanks`, `/reboot/public-offer`, `/reboot/pay-failed`
- compatibility alias retained where required for legacy HTML entry points and asset loading

## Current Runtime Contract

- `short` is the canonical product key and runtime identity for the Short Reboot funnel.
- `reboot` is the canonical public route and host-facing surface.
- static source files stay in `src/landing-static/short/**`.
- static asset serving keeps `short` as source directory and product asset prefix.

## Why

- `short` matches the historical funnel contract, tracking payloads, offer ids, and local source tree
- route health and smoke checks should treat `reboot` as the primary public path
- old `short` links can keep working via redirect without remaining a second canonical surface

## Guardrails

- do not remove `short` aliases where they are still required for utility assets, internal product identity, payment normalization, or static source lookup
- primary smoke coverage should validate canonical `/reboot`
- utility coverage should validate canonical `/reboot/thanks`, `/reboot/public-offer`, `/reboot/pay-failed`
- legacy coverage may additionally assert that `/short` HTML routes redirect to `/reboot`

## Files Owning The Contract

- `src/lib/landing/config.ts`
- `src/lib/landing/contracts.ts`
- `src/lib/staticAssets/serve.ts`
- `src/app/[brand]/[...path]/route.ts`
- `scripts/smoke-landing-next-contract.mjs`
- `scripts/smoke-landing-cutover-toggle.mjs`
