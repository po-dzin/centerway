# CenterWay Design System Spec — 2026-05-17

## Status

Local repo spec.

This document consolidates the current operational design-system state of the CenterWay runtime. It is derived from RAverse canon plus current runtime implementation. It is not an equal semantic source of truth.

## Scope

Applies to:

- platform routes
- platform shell
- platform blocks and components
- admin and dosha surfaces only where they consume the same DS foundations
- landing runtime only where it consumes shared token bridges

Does not replace:

- RAverse canon
- generator manifests
- token source files

## Source Hierarchy

### Semantic source of truth

- `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Дизайн-токены.md`
- `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/UI-UX канон.md`
- `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Блоки и компоненты.md`

### Runtime source of truth

- `data/design-tokens/cw.tokens.json`
- `src/app/globals.css`

### Local operational contracts

- `docs/platform-button-shape-contract-2026-05-14.md`
- `docs/platform-home-hero-recipe-2026-05-17.md`

## System Definition

CenterWay DS is a semantic token system, not a decorative style guide.

The build chain is:

`primitive -> semantic alias -> mode / branch override -> component recipe -> screen assembly`

The system should answer:

- what semantic role a surface has
- what visual behavior that role receives
- how that behavior remains stable across routes and breakpoints

## Semantic Roles

Base roles:

- `calm`
- `method`
- `guide`
- `trust`
- `organic`
- `embodied`
- `progress`
- `boundary`

Operational rule:

- `guide != trust != boundary`
- `organic` and `embodied` do not dominate control hierarchy
- trust and boundary remain visible in risky flows

## Brand Modes

Current brand modes:

- `sanctuary`
- `guide`
- `method`
- `proof`
- `practice`
- `progress`
- `community`

Typical mapping:

- hero / landing -> `sanctuary + guide`
- product / offer -> `guide + proof`
- checkout -> `proof + guide`
- lesson -> `method + practice`
- dashboard -> `progress + method`

## Token Layers

### Layer A — semantic tokens

Examples:

- `--cw-sem-calm-bg`
- `--cw-sem-guide-primary`
- `--cw-sem-guide-strong`
- `--cw-sem-progress`
- `--cw-sem-boundary`

### Layer B — platform aliases

Examples:

- `--cw-platform-bg`
- `--cw-platform-surface`
- `--cw-platform-surface-muted`
- `--cw-platform-text`
- `--cw-platform-muted`
- `--cw-platform-border`
- `--cw-platform-accent`
- `--cw-platform-accent-strong`
- `--cw-platform-accent-contrast`

### Layer C — DS aliases

Examples:

- `--ds-color-*`
- `--ds-space-*`
- `--ds-radius-*`
- `--ds-shadow-*`
- `--ds-font-*`

### Layer D — component recipes

Examples:

- `--cw-radius-btn`
- `--cw-component-glass-*`
- `--cw-depth-*`
- `--cw-btn-primary-*`

### Layer E — screen recipes

Examples:

- topbar shell recipe
- hero framing recipe
- intro / diagnostics recipe

## Naming Contract

### CSS

- `--cw-{group}-{name}` for runtime / product tokens
- `--ds-{group}-{name}` for general DS aliases

### Rules

- no raw hex in component CSS without strong reason
- no ad hoc new radii / shadows / palette values inside module CSS
- prefer semantic alias over primitive usage

## Foundations

### Color

Core palette in runtime:

- calm background
- calm surface
- guide green
- warm gold
- dark ink
- high-contrast light foreground

Current runtime entrypoint:

- `src/app/globals.css`

### Typography

Families:

- UI: `Manrope`
- editorial: `Cormorant Garamond`
- data: `IBM Plex Mono`

Operational split:

- UI family -> navigation, body, controls
- editorial -> large headings and story-weight headings
- mono/data -> labels, chips, compact meta

### Spacing

Primary scale:

- `2xs`
- `xs`
- `sm`
- `md`
- `lg`
- `xl`
- `2xl`
- `3xl`

Section rhythm:

- `--cw-space-section-y`

### Radius

Current runtime radii:

- `--cw-radius-sm`
- `--cw-radius-md`
- `--cw-radius-lg`
- `--cw-radius-pill`

Primary button shape:

- `--ds-radius-button-soft: 1rem`
- `--cw-radius-btn: var(--ds-radius-button-soft)`

### Shadows and depth

Base depth family:

- `--cw-depth-shadow-soft`
- `--cw-depth-shadow-medium`
- `--cw-depth-shadow-strong`

Depth surfaces:

- `--cw-depth-card-bg`
- `--cw-depth-support-bg`
- `--cw-depth-proof-bg`
- `--cw-depth-boundary-bg`
- `--cw-depth-icon-slot-bg`

## Layout System

### Container

- `--cw-max-width: 1160px`
- standard container usage lives in shell and block modules

### Density bands

- `Air`
- `Balanced`
- `Compact`
- `Tight`

Platform public surfaces mostly target:

- hero -> `Air`
- standard sections -> `Balanced`

### Grid families

Current recurring layout families:

- full-bleed hero
- content container section
- `grid2`
- `grid3`
- program showcase grid
- split media + text grids
- footer 3-column grid

## Component Families

### Shell

- page shell
- topbar shell
- section shell

### Actions

- primary route action
- secondary learn / detail action
- ghost / support action
- topbar utility action

### Cards

- program cards
- proof / support cards
- route choice / diagnostics cards
- author fact cards

### Inputs

- text input
- select
- textarea

### Navigation

- topbar nav
- mobile menu
- route anchors

## Action Geometry Rule

Main platform CTA surfaces use soft rounded rect.

Applies to:

- primary buttons
- secondary buttons
- ghost buttons
- hero CTA
- program CTA
- desktop / tablet topbar shell

Does not apply to:

- chips
- micro topbar utility pills
- circular markers
- mobile topbar glass band

Current local contract:

- `docs/platform-button-shape-contract-2026-05-14.md`

## Topbar Rule

Topbar is a glass shell, not a set of isolated pills.

Rules:

- desktop/tablet shell uses DS soft rounded rect family
- mobile header remains a glass band without independent rounded shell container
- logo and menu/profile elements sit on one common atmospheric layer
- contrast switches with underlying hero tone

Current runtime implementation:

- `src/components/platform/PlatformShell.module.css`
- `src/components/platform/PlatformResponsive.module.css`

## Hero Rule

Home hero is the platform orientation surface.

Rules:

- one photographic atmosphere layer
- one text column
- one primary CTA
- no competing secondary CTA in first screen slice
- overlay protects readability
- framing changes by breakpoint recipe, not by random one-off edits

Current recipe family:

- `--cw-hero-photo-x`
- `--cw-hero-photo-y`
- `--cw-hero-photo-shift-y`
- `--cw-hero-photo-scale`
- `--cw-hero-photo-origin`

Current local contract:

- `docs/platform-home-hero-recipe-2026-05-17.md`

## Surface Rules

### Calm surfaces

- stable, low-noise background
- used for broad platform sections

### Proof surfaces

- tonal shift, not loud status fill
- used for trust / expectation / factual support

### Boundary surfaces

- restrained warning semantics
- must remain visible without panic styling

### Glass surfaces

- reserved for topbar / selected atmospheric controls
- should not become generic default card style

## Interaction States

Every interactive family should support where relevant:

- `default`
- `hover`
- `focus-visible`
- `active`
- `selected`
- `disabled`
- `loading`
- `success`
- `warning`
- `error`

Rules:

- states must not rely only on color
- focus must remain visible
- hover should not create a different semantic role

## Responsive Contract

Primary breakpoint logic:

- mobile max: `<= 560px`
- tablet: `561px - 900px`
- desktop: `>= 901px`

Rules:

- breakpoint changes adjust recipe values, not semantic structure, unless required
- desktop / tablet / mobile hero framing are separate recipes
- mobile layouts may collapse multi-column structures to one column
- mobile footer and desktop footer may share structure but have different alignment recipes

## Accessibility Baseline

Required:

- visible focus states
- readable contrast
- mobile-safe target sizes
- one clear primary action per critical screen slice
- recovery path in risky flows

## Validation Stack

Core:

- `npm run lint`
- `npm run build`
- `npm run canon:guard`
- `npm run guard:ds-contract`
- `npm run semantic:audit`

Generator:

- `npm run generator:validate`
- `npm run generator:snapshot`
- `npm run generator:determinism`
- `npm run generator:language`
- `npm run guard:rhythm`

## Anti-Patterns

- raw visual overrides without semantic role
- new one-off shadows / radii / palette values in component modules
- multiple equally loud primary CTAs in one slice
- glass used as a generic substitute for hierarchy
- decorative wellness softness that weakens route clarity
- framing hero by repeated ad hoc tweaks without recipe discipline

## What should move to RAverse later

Promote when stable:

- primary CTA soft-rect rule
- desktop / tablet topbar shell geometry rule
- any stable footer family rule that applies across platform surfaces
- hero recipe only if it becomes a reusable platform-hub invariant

## What stays local for now

- current hero breakpoint framing values
- route-local tuning notes
- tactical audits and comparisons
- temporary implementation recipes still being iterated
