# Platform Foundation Normalization

Scope: main-domain platform only. Subdomain landings stay out of scope until the platform DS is fully stabilized.

Semantic role:
- platform shell, route, orientation, offer, trust, utility

User question:
- how to move through the main CenterWay domain without visual drift between routes and breakpoint states

Token source:
- shared runtime DS tokens in `src/app/globals.css`
- no new parallel token layer added

Applied foundation values:
- touch target minimum: `3rem`
- button minimum height: `3rem`
- focus ring width: `3px`
- focus ring offset: `3px`
- label text: `0.75rem / 1rem`
- body text: `1rem / 1.6`
- body small: `0.9375rem / 1.5`
- lead text: `clamp(1rem, 1.5vw, 1.125rem) / 1.6`
- title text: `clamp(2.25rem, 4.9vw, 3.75rem) / 1.04`
- hero text: `clamp(3.25rem, 7.6vw, 6.75rem) / 0.96`
- display text: `clamp(1.5rem, 3vw, 2.2rem) / 1.08`

Normalization result:
- platform shell navigation, menu actions, buttons, tabs, inputs, and pagination now use the same touch and focus contract
- orientation, route, offer, trust, and utility blocks now consume shared type tokens instead of local near-duplicate numeric values
- tablet and mobile overrides were aligned to the same token set so breakpoint styles no longer reintroduce separate typography or CTA heights

Known boundary:
- this wave does not yet unify subdomain landing surfaces
