# Legal landing DS delivery — 2026-08-24

## Scope

Static policy (`index2.html`) and public-offer (`public-offer.html`) pages for
`short`, `irem`, `way21`, and `reset-day` share one delivery layer:
`src/landing-static/shared/css/legal-pages.css`.

## Semantic contract

- Surface: legal pages in product funnels.
- Role: `trust / boundary`.
- User question: where can I verify the rules for payment, access, and refunds?
- Token source: generated landing DS (`cw-tokens.generated.css`) with the
  network token delivery and existing `--ds-*` fallbacks.
- Content source: the existing legal documents; the delivery layer does not
  alter their legal wording.
- Route boundary: each legal document stays inside its product funnel.

## Behaviour

Every guarantee statement links to the `#refund-policy` anchor in the policy
of its own funnel. The `short-b` experiment intentionally links to the Short
policy because it shares that checkout and legal surface.

## Canon decision

This is a local implementation normalization of existing trust and token
contracts. It creates no new product, claim, or cross-route policy rule, so no
RAverse canon update is required.
