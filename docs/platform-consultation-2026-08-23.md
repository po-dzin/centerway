# Platform consultation surface

## Scope

This note records the route-local structure of the platform consultation page at
`/consult`. It does not change the static `consult.*` landing, checkout, pricing,
or the public funnel topology.

## Semantic contract

- Semantic role: route a person from an unclear wellbeing request to a personal
  consultation and an explicit next step.
- User question: "Is this consultation appropriate for me, what happens, who
  leads it, and what should I expect?"
- Token source: the global platform design system and existing trust/support
  recipes; no route-local palette, type scale, radius, shadow, or glass recipe.
- Content source: the active consultation copy plus the same author portrait,
  biography, and credentials used by the platform home author block.
- Route boundary: `platform:/consult`; lead capture remains `product_code:
  consult`, and no checkout is introduced.

## Page order

1. Consultation hero and primary request action.
2. Typical signals and the three-step request-to-plan path.
3. Author identity with the shared portrait and credentials.
4. Education and practice path.
5. Health and medical boundary.
6. Consultation FAQ.
7. Format, duration, expectations, and final lead form.

The author image uses `/shared/img/author-evgeniy-2026-08.webp`, matching the
home surface. The boundary remains visible before the final form, and the page
states explicitly that a consultation does not have to end in a course sale.

## Validation

- `npx vitest run src/components/platform/consultPageContract.test.ts`
- `npm run lint`
- `npm run build`
- manual mobile QA at 375-390 px, including focus, FAQ disclosure, portrait
  crop, and the final form.

This is a route-local implementation record. The active RAverse consultation
and trust-boundary rules already cover the resulting behavior, so no shared
canon promotion is required for this change.
