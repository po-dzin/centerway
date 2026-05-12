# Short/Reboot Routing Contract

Status: active local contract

## Canon

- `short` is the canonical product key in code, analytics, payment payloads, and static asset prefixes.
- `reboot` is a public route and host alias that remains in use for the Short Reboot landing entry and payment return surface.

## Expected split

- Product semantics:
  - `short`
- Asset prefix and utility HTML:
  - `/short/*`
- Public entry route for the short funnel:
  - `/reboot`
- Paid/failed return destination for the short funnel:
  - `https://reboot.centerway.net.ua/thanks`
  - `https://reboot.centerway.net.ua/pay-failed`

## Why this is not a drift bug

This is an intentional split contract, not an incomplete migration:

- internal product identity stays normalized to `short`
- the public reboot host remains the stable external surface for entry and post-payment return flows

## Naming rule for implementation

When code refers to the public reboot-facing surface, prefer names like:

- `publicEntryRoute`
- `publicRouteName`
- `public alias`

Avoid using names like `entryPage` when the value is only a public alias, because that makes `reboot` look like the canonical product key.

## Smoke expectation

The landing contract smoke should intentionally validate the mixed surface:

- entry routes:
  - `/reboot`
  - `/irem`
- utility Purchase routes:
  - `/short/thanks.html`
  - `/irem/thanks.html`

This is correct as long as the reboot domain remains the short funnel return surface.
