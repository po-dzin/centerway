# CenterWay Design System Brandbook Extract

## Status

Local operational extract from the current codebase as of 2026-06-27.

This file is implementation evidence first. It converts the active runtime design system into a readable brandbook shape before promotion into RAverse storage.

## Source Stack

Semantic canon:

- `docs/CANON.md`
- `docs/platform_agent_preflight.md`
- `../RAverse/ReOS/Projects/CenterWay/CenterWay.md`
- `../RAverse/ReOS/Projects/CenterWay/Бренд-контракт.md`
- `../RAverse/ReOS/Projects/CenterWay/Дизайн-токены.md`
- `../RAverse/ReOS/Projects/CenterWay/Семиотический паспорт.md`
- `../RAverse/ReOS/Projects/CenterWay/UI-UX канон.md`
- `../RAverse/ReOS/Projects/CenterWay/Блоки и компоненты.md`
- `../RAverse/ReOS/Projects/CenterWay/Архитектура.md`
- `../RAverse/ReOS/Projects/CenterWay/Лендинги.md`
- `../RAverse/ReOS/Projects/CenterWay/Реестр.md`

Runtime sources:

- `data/design-tokens/cw.tokens.json`
- `data/generator/token_packs.json`
- `data/generator/block_manifests.json`
- `data/generator/screen_manifests.json`
- `data/generator/route_family_contracts.json`
- `src/app/globals.css`
- `src/landing-static/shared/css/tokens.css`
- `src/lib/generator/theme.ts`
- `src/lib/generator/themeCatalog.ts`
- `scripts/generate-design-tokens.mjs`

Consumer surfaces checked:

- `src/components/platform/**`
- `src/components/generator/**`
- `src/components/admin/**`
- `src/components/dosha-test/**`

## Semantic Contract

- `surface`: cross-route design-system reference
- `semantic_role`: trust + method + guide
- `user_question`: how the live CenterWay design system is actually built and applied
- `token_source`: `data/design-tokens/cw.tokens.json` with delivery through `src/app/globals.css` and `src/landing-static/shared/css/tokens.css`
- `content_source`: active canon plus runtime implementation
- `route_boundary`: project-wide, not route-specific

## System Definition

CenterWay design system in code is a semantic runtime, not a decorative style layer.

Build chain:

`primitive -> semantic alias -> mode override -> component recipe -> route/screen assembly -> component consumption`

The stable runtime center is split into three parts:

1. `cw.tokens.json` defines semantic aliases, mode overrides, component recipes, route overlays, app aliases, and landing aliases.
2. `globals.css` materializes those tokens into the app runtime and DS alias delivery layer.
3. generator manifests bind semantic roles, user questions, token recipes, renderers, and route boundaries to actual public screens.

## Semantic Roles In Runtime

Base semantic roles confirmed in canon and runtime naming:

- `calm`
- `method`
- `guide`
- `trust`
- `organic`
- `embodied`
- `progress`
- `boundary`

Block-level semantic roles confirmed in generator manifests:

- `orientation`
- `method`
- `offer`
- `proof`
- `boundary`
- `progress`
- `route-map`

Core invariant:

- `guide != trust != boundary`
- trust and boundary stay visible in sensitive flows
- route logic is encoded in manifests, not improvised per page

## Theme Families

Active token-pack families extracted from `data/generator/token_packs.json`:

- `warm-mineral`
- `living-mineral`
- `natural-premium`
- `natural3`
- `curcuma`

Observed preview roles carried per theme:

- `--cw-bg`
- `--cw-text`
- `--cw-accent`
- `--cw-status-success`
- `--cw-status-pending`
- `--cw-role-trust-proof-surface`
- `--cw-role-trust-policy-surface`
- `--cw-role-support-surface`

Default semantic center in canon remains `living-mineral`, but funnel screens currently use `token_pack.warm-mineral.v1` in screen manifests for `consult`, `detox`, and `herbs`.

## Foundation Tokens

### Typography

Runtime families:

- UI: `Manrope`
- Editorial: `Cormorant Garamond`
- Data/meta: `IBM Plex Mono`

Legacy landing bridge still exposes `Formular` in `src/landing-static/shared/css/tokens.css`, which confirms an active dual-layer runtime: platform/app DS vs legacy landing bridge.

### Spacing

Shared CW spacing scale:

- `--cw-space-2xs`
- `--cw-space-xs`
- `--cw-space-sm`
- `--cw-space-md`
- `--cw-space-lg`
- `--cw-space-xl`
- `--cw-space-2xl`
- `--cw-space-3xl`
- `--cw-space-section-y`

Shared DS spacing scale:

- `--ds-space-1` through `--ds-space-7`

### Radius

CW runtime:

- `--cw-radius-sm`
- `--cw-radius-md`
- `--cw-radius-lg`
- `--cw-radius-pill`
- `--cw-radius-btn`

DS bridge:

- `--ds-radius-sm`
- `--ds-radius-md`
- `--ds-radius-lg`
- `--ds-radius-pill`
- `--ds-radius-button-soft`

### Depth and Shadow

Core depth recipes extracted from `cw.tokens.json` and `globals.css`:

- `--cw-depth-card-bg`
- `--cw-depth-support-bg`
- `--cw-depth-proof-bg`
- `--cw-depth-boundary-bg`
- `--cw-depth-icon-slot-bg`
- `--cw-depth-rail-color`
- `--cw-depth-shadow-soft`
- `--cw-depth-shadow-medium`
- `--cw-depth-shadow-strong`

### Glass and Shell

Observed shell/glass recipe tokens:

- `--cw-component-glass-bg`
- `--cw-component-glass-bg-hover`
- `--cw-component-glass-border`
- `--cw-component-glass-filter`
- `--cw-component-glass-shadow`
- `--cw-surface-glass-bg`
- `--cw-surface-glass-bg-hover`
- `--cw-surface-shell-control-bg`
- `--cw-surface-shell-popover-bg`
- `--cw-shell-frost-bg`
- `--cw-shell-frost-filter`

## Brand Assets In Tokens

The logo system is already tokenized in runtime and belongs in the brandbook:

- `--cw-brand-asset-logo-symbol`
- `--cw-brand-asset-logo-symbol-header`
- `--cw-brand-asset-lockup-header`
- `--cw-brand-asset-wordmark-dark`
- `--cw-brand-asset-wordmark-light`
- `--cw-brand-size-symbol-header`
- `--cw-brand-size-wordmark-header-width`
- `--cw-brand-size-wordmark-header-height`
- `--cw-brand-size-symbol-footer`
- `--cw-brand-size-wordmark-footer-width`
- `--cw-brand-size-wordmark-footer-height`

This means the codebase already treats brand identity as part of the token contract, not as loose media.

## Route And Surface Contracts

Route-family contracts in runtime:

- `funnel surface`
- `utility`

Confirmed route boundaries:

- `isolated funnel route`
- `platform utility route`

Required semantic roles by route family:

- funnel surface: `orientation`, `offer`, `boundary`
- utility: `orientation`

Observed screen assembly:

- `consult`, `detox`, `herbs` use the funnel surface archetype `offer-detail`
- utility lesson surface uses `lesson-practice` / `support-proof`

## Component Families In Code

Generator manifests confirm these reusable families in live runtime:

- `page-shell`
- `section-shell`
- `route-action-button`
- `proof-card`
- `boundary-block-component`
- `stage-card`
- `expectation-block-component`

Canon-level families actively reflected in code structure:

- shell
- route/orientation
- offer
- trust/proof
- boundary
- progress/next-step
- forms and feedback
- admin utility

The platform CSS split also shows the intended structure:

- `PlatformShell.module.css`
- `PlatformBlocks.module.css`
- `PlatformComponents.module.css`
- `PlatformResponsive.module.css`

`PlatformSite.module.css` is now explicitly a deprecated compatibility entrypoint, not the place to grow new patterns.

## CTA Contract In Runtime

Primary button runtime tokens observed in `globals.css`:

- `--cw-btn-primary-bg`
- `--cw-btn-primary-bg-hover`
- `--cw-btn-primary-bg-active`
- `--cw-btn-primary-text`
- `--cw-btn-primary-border-hover`
- `--cw-btn-primary-border-active`
- `--cw-btn-primary-focus-ring`

Secondary behavior also exists as tokenized families:

- `--cw-btn-outline-*`
- `--cw-btn-ghost-*`

This confirms the codebase already centralizes CTA behavior and should not document buttons as one-off component styling.

## Trust, Boundary, Support Layer

The most important design-system fact extracted from code is that trust surfaces are first-class tokens, not just copy sections.

Observed token and theme roles:

- `--cw-role-trust-proof-surface`
- `--cw-role-trust-policy-surface`
- `--cw-role-support-surface`
- `--cw-color-trust-info`
- `--cw-depth-proof-bg`
- `--cw-depth-boundary-bg`
- `--cw-depth-support-bg`

This matches canon: trust, boundary, and support are distinct roles and should remain separate in the brandbook.

## Runtime Delivery Model

The script `scripts/generate-design-tokens.mjs` proves the delivery model:

- runtime layers are flattened from `semanticAliases`, `componentRecipes.depth`, `modeOverrides.platform`, `componentRecipes.glass`, and `routeOverlays.platform`
- output is injected into `src/app/globals.css`
- app aliases and DS aliases are injected separately for light and dark delivery blocks

So the brandbook must describe both:

1. semantic meaning
2. delivery path into CSS/runtime

## Current Drift Signals

From the codebase state, these gaps remain visible:

- landing bridge still carries a legacy DS palette and `Formular` defaults beside the platform token layer
- raw product-specific DS tokens still exist in shared landing token delivery
- runtime contains both platform-native tokens and landing bridge aliases, so documentation must distinguish canonical system from compatibility layer

## Promotion Target

This extract should be promoted as a RAverse project-level `Брендбук.md` with:

- semantic definition
- token architecture
- theme families
- typography
- color and depth logic
- logo/tokenized identity
- component family map
- route-boundary rules
- implementation sources

It should not replace `Бренд-контракт.md` or `Дизайн-токены.md`; it should sit between them as a readable design reference derived from live code.
