# Platform Agent Preflight

This file exists to make the CenterWay canon operational for future platform work. It is not optional process documentation; it is the checklist agents must satisfy before changing public UI.

`docs/legacy/**` is not part of the active preflight set. Use legacy docs only when provenance or an old implementation decision must be traced explicitly.

## Canon Sources

The only semantic/governance canon lives in:

`/Users/G/Documents/RAverse/ReOS/Projects/CenterWay`

Current required files:

- `CenterWay.md`
- `Бренд-контракт.md`
- `Дизайн-токены.md`
- `Семиотический паспорт.md`
- `UI-UX канон.md`
- `Блоки и компоненты.md`
- `Архитектура.md`
- `Лендинги.md`
- `Реестр.md`

Local implementation references are derived / implementation-only:

- `docs/CANON.md`
- `docs/design-system.md` (living DS reference: vocabulary axes, token layer map, coverage boundary)
- `README.md` / `Token Contract`
- `src/app/globals.css`
- `data/design-tokens/cw.tokens.json`
- `data/generator/screen_manifests.json`
- `data/generator/block_manifests.json`
- `data/generator/route_family_contracts.json`
- `docs/adr/0004-the-screen-generator-is-a-dormant-spec-not-runtime-code.md`
- `src/components/platform/PlatformStandalonePages.tsx`
- `src/components/platform/PlatformOfferSurfaceTemplate.tsx`
- `src/components/platform/PlatformStyles.ts`
- `scripts/lib/generator-manifests.mjs`
- `data/canon/registry.snapshot.json`
- `scripts/semantic-audit.mjs`

## Pre-Edit Output Required In Agent Reasoning

Before editing, determine:

- `surface`: platform hub, expert page, program page, product funnel, legal, admin, dosha, or utility.
- `semantic_role`: orientation, route, method, offer, trust, proof, support, care, progress, or boundary.
- `user_question`: the concrete question this block answers.
- `token_source`: global/data DS token, global app DS delivery token, or explicitly approved component recipe token.
- `content_source`: canon, old Wix content, existing landing, database/API, or new product copy.
- `route_boundary`: platform route or separate funnel route.

If any item is unclear, do not invent visual structure first. Resolve the semantic role and token source first.

## Canon Sync Trigger

If the work materially changes public structure, semantic block composition, CTA hierarchy, token contracts, route-family contracts, route boundaries, or trust surfaces, the agent must also decide whether the shared canon needs an update in the same work cycle.

Use this rule:

- local implementation detail only -> document locally if needed;
- durable cross-page or cross-route rule change -> update the relevant RAverse canon note.

## Current Runtime Boundary

Public platform pages use typed React composition. Static landing runtime owns
funnels. `data/generator/**` is a dormant specification held under generator
and semantic gates (ADR-0004); its successful validation does not prove a live
React page's composition. `PlatformSite.module.css` is a deprecated compatibility
entrypoint; shared recipes are already split and consumed through `PlatformStyles`.

New platform pages use shared DS/global tokens, semantic reusable route/offer/
trust/proof components and the current typed renderer. Route-file composition is
checked by ESLint; route/component behavior by relevant contracts and browser smoke.

## Canon Metadata Verification

Run `npm run guard:canon-metadata`. It checks the committed metadata derivative,
paths, hooks, links and registry correspondence. When RAverse is reachable it
also compares the live projection; without it, output explicitly says snapshot-only.
After an authorized canon update, run `npm run docs:canon:sync` and commit the
updated derivative with the implementation. The derivative is not a second canon.

For changed interactive controls also declare `selection_family` (contour, ink,
hybrid), boundary role, and the reading/editing selection boundary under the
contracts in `docs/design-system.md`. Ink states reuse `InteractionInkLabel` /
`InteractionInkIcon`; transient results reuse the shared application toast provider.
