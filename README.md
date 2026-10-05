# CenterWay

Next.js runtime for the current CenterWay product surface.

## What lives here

- platform routes: home, expert, consult, programs, legal, support surfaces
- dosha-test flow and related API endpoints
- admin surface and admin API endpoints
- host-based landing routing for `reboot.*` and `irem.*`
- static landing assets under `src/landing-static/*`
- live design tokens, dormant generator specifications and canon metadata derivative

## Canon

- shared semantic source of truth: `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay`
- local implementation notes: `docs/**`
- local canon policy: `docs/CANON.md`
- local platform preflight: `docs/platform_agent_preflight.md`
- local DS spec: `docs/design-system.md`
- `docs/legacy/**` is read-only provenance, not active guidance

## Run

```bash
npm install
npm run dev
```

App runs on `http://localhost:8000`.

## Core checks

```bash
npm run lint
npm run build
npm run guard:canon
npm run guard:canon-metadata
npm run guard:ds-contract
npm run guard:semantic
```

## Generator checks

```bash
npm run generator:validate
npm run generator:snapshot
npm run generator:determinism
npm run generator:language
npm run guard:rhythm
```

Combined gate:

```bash
npm run verify:generator
```

## Route and surface smoke

### Admin

```bash
npm run smoke:admin
npm run verify:admin
npm run smoke:admin:ui
npm run smoke:admin:responsive
```

Some admin checks require `SMOKE_ADMIN_BEARER`.

### Dosha

```bash
npm run smoke:dosha:result
npm run smoke:dosha:api
npm run smoke:dosha:userflows
npm run smoke:dosha:responsive
npm run smoke:dosha:brand-fit
```

Combined gate:

```bash
npm run verify:dosha
```

### Landings

```bash
npm run smoke:landing:short-irem
npm run smoke:landing:next-contract
npm run smoke:landing:cutover-toggle
npm run smoke:landing:baseline
```

Combined gate:

```bash
npm run verify:landing
```

## Main runtime areas

- app routes: `src/app/**`
- platform UI: `src/components/platform/**`
- dormant generator specification: `data/generator/**`, validated by `scripts/lib/generator-manifests.mjs` (ADR-0004)
- landing runtime: `src/landing-static/**`
- scripts and guards: `scripts/**`
- data and specification manifests:
  - `data/design-tokens/cw.tokens.json`
  - `data/generator/screen_manifests.json`
  - `data/generator/block_manifests.json`
  - `data/generator/route_family_contracts.json`

## Notes

- repo docs are derived / operational
- promote only stable cross-project rules into RAverse
- for public UI work, use `docs/platform_agent_preflight.md`

## Canon and icon gates

`npm run verify:guards` runs file-only gates. `guard:canon-metadata` checks the
committed derivative and, locally when reachable, live RAverse. CI without the
external source reports snapshot-only, not live-canon PASS. After changing shared
canon, run `npm run docs:canon:sync` and include its derivative in the change.

Icon reproduction is a separate offline browser tool: install Chromium with
`npx playwright install chromium`, then run `npm run verify:icons`. Design CI
runs both file guards and this tool. Generator gates validate a dormant design
specification; they are not browser evidence for the current public pages.
