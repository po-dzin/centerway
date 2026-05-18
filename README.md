# CenterWay

Next.js runtime for the current CenterWay product surface.

## What lives here

- platform routes: home, expert, consult, programs, legal, support surfaces
- dosha-test flow and related API endpoints
- admin surface and admin API endpoints
- host-based landing routing for `reboot.*` and `irem.*`
- static landing assets under `src/landing-static/*`
- design-token, generator, and canon runtime manifests

## Canon

- shared semantic source of truth: `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay`
- local implementation notes: `docs/**`
- local canon policy: `docs/CANON.md`
- local platform preflight: `docs/platform_agent_preflight.md`
- local DS spec: `docs/design-system-spec-2026-05-17.md`
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
npm run canon:guard
npm run guard:ds-contract
npm run semantic:audit
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
npm run generator:gate
```

## Route and surface smoke

### Admin

```bash
npm run smoke:admin
npm run smoke:admin:ci
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
npm run smoke:dosha:qa
```

### Landings

```bash
npm run smoke:landing:short-irem
npm run smoke:landing:next-contract
npm run smoke:landing:cutover-toggle
npm run baseline:landing:short-irem
```

Combined gate:

```bash
npm run gate:landing:short-irem
```

## Main runtime areas

- app routes: `src/app/**`
- platform UI: `src/components/platform/**`
- generator runtime: `src/lib/generator/**`
- landing runtime: `src/landing-static/**`
- scripts and guards: `scripts/**`
- design/runtime manifests:
  - `data/design-tokens/cw.tokens.json`
  - `data/generator/screen_manifests.json`
  - `data/generator/block_manifests.json`
  - `data/generator/route_family_contracts.json`

## Notes

- repo docs are derived / operational
- promote only stable cross-project rules into RAverse
- for public UI work, use `docs/platform_agent_preflight.md`
