# IREM Landing Topology Simplification

Date: `2026-06-29`

## What Changed

- `src/landing-static/irem/**` is now the only active static source layer for the IREM funnel.
- The promoted entry source is the former `irem-v2` landing, now living at `src/landing-static/irem/index.html`.
- The former legacy IREM runtime was moved to `src/landing-static/legacy/irem-v1/**`.
- The former `irem-v2` source snapshot was moved to `src/landing-static/legacy/irem-v2-promoted/**`.
- Public host and entry contract did not change: `irem.centerway.net.ua` and `/irem` remain canonical.
- `/irem-v2` was removed from active routing and should now resolve to `404`.

## Runtime Contract

- Funnel host root rewrites to active `/irem`.
- IREM utility pages remain funnel-owned:
  - `/irem/index2.html`
  - `/irem/public-offer.html`
  - `/irem/thanks`
  - `/irem/pay-failed`
- `index2.html` now runs through the same managed secondary-page preparation flow as the other IREM legal/utility pages instead of bypassing it as a raw static file.
- Entry, legal, and utility pages share one IREM theme file:
  - `src/landing-static/irem/css/irem.theme.css`

## Notes

- `irem.theme.css` holds both promoted entry styling and the compatibility layer for utility/legal surfaces.
- Personal offer rendering for `offer_token` now runs through the common IREM entry pipeline instead of the removed dedicated `/irem-v2` route.
- Social footer icons used by `consult`, `detox`, and `herbs` were moved to `src/landing-static/shared/img/social/**` so active IREM no longer owns cross-funnel shared assets.
