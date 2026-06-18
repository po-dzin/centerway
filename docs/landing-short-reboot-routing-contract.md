# Short/Reboot Routing Contract

Status: active local contract

## Canon

- `short` is the canonical product key in code, analytics, payment payloads, and static asset prefixes.
- `reboot` is the canonical public route and host-facing return surface.
- `short` remains a runtime/product identity, asset namespace, and compatibility alias.

## Expected split

- Product semantics:
  - `short`
- Asset prefix:
  - `/short/*`
- Public entry route for the short funnel:
  - `/reboot`
- Public utility routes for the short funnel:
  - `/reboot/thanks`
  - `/reboot/pay-failed`
  - `/reboot/public-offer`
- Paid/failed return destination for the short funnel:
  - `https://reboot.centerway.net.ua/thanks`
  - `https://reboot.centerway.net.ua/pay-failed`

## Why this is not a drift bug

This is an intentional split contract, not an incomplete migration:

- internal product identity stays normalized to `short`
- static source files and asset lookup remain rooted in `src/landing-static/short/**`
- the public reboot host remains the stable external surface for entry and post-payment return flows
- `/short` HTML routes are compatibility aliases and should redirect to their `/reboot` counterparts

## Naming rule for implementation

When code refers to the public reboot-facing surface, prefer names like:

- `publicEntryRoute`
- `publicRouteName`
- `public alias`

Avoid using names like `entryPage` when the value is only a public alias, because that makes `reboot` look like the canonical product key.

## Smoke expectation

The landing contract smoke should validate the canonical short surface first:

- entry routes:
  - `/reboot`
  - `/irem`
- utility Purchase routes:
  - `/reboot/thanks`
  - `/irem/thanks.html`
