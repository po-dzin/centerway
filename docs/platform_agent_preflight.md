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
- `README.md` / `Token Contract`
- `src/app/globals.css`
- `data/design-tokens/cw.tokens.json`
- `data/generator/screen_manifests.json`
- `data/generator/block_manifests.json`
- `data/generator/route_family_contracts.json`
- `src/lib/generator/canon.ts`
- `src/components/generator/GeneratedRouteScreen.tsx`
- `src/components/platform/PlatformGeneratedBlock.tsx`
- `src/components/platform/PlatformSite.module.css`
- `scripts/semantic-audit.mjs`

## Pre-Edit Output Required In Agent Reasoning

Before editing, determine:

- `surface`: platform hub, expert page, program page, product funnel, legal, admin, dosha, or utility.
- `semantic_role`: orientation, route, method, offer, trust, proof, support, care, progress, or boundary.
- `user_question`: the concrete question this block answers.
- `token_source`: generated runtime token pack, global app DS delivery token, or explicitly approved component recipe token.
- `content_source`: canon, old Wix content, existing landing, database/API, or new product copy.
- `route_boundary`: platform route or separate funnel route.

If any item is unclear, do not invent visual structure first. Resolve the semantic role and token source first.

## Canon Sync Trigger

If the work materially changes public structure, semantic block composition, CTA hierarchy, token contracts, route-family contracts, route boundaries, or trust surfaces, the agent must also decide whether the shared canon needs an update in the same work cycle.

Use this rule:

- local implementation detail only -> document locally if needed;
- durable cross-page or cross-route rule change -> update the relevant RAverse canon note.

## Current Platform Debt

Public platform pages now route through generator screen manifests and `GeneratedRouteScreen`. The remaining platform debt is that `src/components/platform/PlatformSite.module.css` still contains legacy shell/block/component/responsive recipes in one module. Treat it as a compatibility layer to split, not a pattern to expand.

Any new platform page must move toward:

- DS/global token consumption;
- semantic block composition from manifest contracts;
- reusable route/offer/trust/proof components;
- no ad hoc page-level palette.
