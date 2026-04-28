# CenterWay Platform App

Next.js runtime for:
- host-based landing routing (`reboot.*` and `irem.*`)
- payment API endpoints
- static landing assets under `src/landing-static/*`

## Documentation and Canon

Local implementation notes and operational decisions live in `docs/**`.

`docs/legacy/**` is a read-only reservoir of superseded specs and migration-era documents. It is not part of the active agent reading set.

The shared stable canon lives in `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay` and should only be updated when a local decision becomes a durable cross-project rule. See [docs/CANON.md](docs/CANON.md).

## Run

```bash
npm install
npm run dev
```

## Validate

```bash
npm run lint
npm run build
npm run smoke:admin:governance
npm run smoke:admin:i18n-tone
npm run smoke:admin:a11y-contract
npm run smoke:admin
npm run smoke:admin:auth
npm run smoke:admin:authz-surface
npm run smoke:admin:funnel
npm run smoke:admin:payload-contracts
npm run smoke:admin:write-guards
npm run smoke:admin:authz-coverage
npm run smoke:admin:ci
npm run smoke:admin:ui
npm run smoke:admin:responsive
npm run smoke:dosha:result
```

`smoke:admin:auth` requires `SMOKE_ADMIN_BEARER` and validates 200-contracts for core admin endpoints.
`smoke:admin:funnel` requires `SMOKE_ADMIN_BEARER` and validates analytics invariants (funnel/CAPI consistency).
`smoke:admin:governance` enforces token-first style rules, forbidden classes, and reduced-motion/focus contracts.
`smoke:admin:i18n-tone` verifies RU/EN admin key parity and blocks pressure/urgency phrasing in admin copy.
`smoke:admin:a11y-contract` validates modal semantics, reduced-motion, and blocks non-semantic clickable blocks.
`smoke:admin:payload-contracts` validates error/payload contracts for admin mutate endpoints.
`smoke:admin:write-guards` optionally uses `SMOKE_USER_BEARER` to assert strict `403` on mutate endpoints for non-admin users.
`smoke:admin:ci` runs the full smoke suite sequentially and auto-skips admin-token checks when `SMOKE_ADMIN_BEARER` is not set.
`smoke:admin:ui` runs browser-level smoke checks for `/admin`, `/admin/analytics`, `/admin/system/audit` (requires Playwright).
`smoke:admin:responsive` runs responsive matrix checks for `/admin/*` at `375/768/1024/1440` (requires Playwright + base URL).
`smoke:dosha:result` validates the dosha result matrix (`single/dual/tridosha`) used by test scoring.
`ds:qa` runs baseline design-system quality checks (token contract + lint).
`ds:qa:landing` runs design-system contract checks plus landing smoke (`short/irem`).
`smoke:landing:short-irem` accepts `SMOKE_LANDING_ENTRY=next|fallback` (`next` by default).
`smoke:landing:next-contract` checks `/reboot` and `/irem` HTML contract (managed bridge/runtime injection, no legacy inline attribution block). Set `SMOKE_REQUIRE_NEXT_LANDING=1` to fail when routes are still in legacy fallback.
`baseline:landing:short-irem` saves full-page baseline screenshots for `390/768/1024/1440` into `artifacts/landing-baseline/*` and accepts `BASELINE_LANDING_ENTRY=next|fallback`.

## Next Landing Rollout (`short/irem`)

- Feature flag: `CW_NEXT_LANDING_SHORT_IREM=1` enables Next-managed entrypoints for `/reboot` and `/irem`.
- Default (flag on): Next-managed entrypoints are enabled.
- Fallback/rollback: unset the flag to route traffic back to `/short/index.html` and `/irem/index.html`.
- Typed hero rollout flag: `CW_TYPED_HERO_SHORT_IREM=1` enables typed hero replacements for `short/irem`.
- Default for typed hero flag is off: `CW_TYPED_HERO_SHORT_IREM=0`.
- Next entrypoints preserve legacy DOM and JS behavior, but move inline tracking bootstrap to managed shared runtime:
  - `/shared/js/landing-pixel.js`
  - `/shared/js/landing-runtime.js`
  - `/shared/css/landing.bridge.css`

### Local Check (No Browser Smoke)

```bash
node scripts/guard-ds-contract.mjs
npm run -s lint
npm run -s build
SMOKE_BASE_URL=http://localhost:8000 npm run -s smoke:landing:cutover-toggle
SMOKE_BASE_URL=http://localhost:8000 SMOKE_REQUIRE_NEXT_LANDING=1 npm run -s smoke:landing:next-contract
```

Optional one-shot gate without browser smoke:

```bash
SMOKE_BASE_URL=http://localhost:8000 LANDING_GATE_BROWSER_SMOKE=off npm run -s gate:landing:short-irem
```

## Token Contract

- `src/landing-static/shared/css/tokens.css` is the shared fallback contract for landing assets served via app routes.
- `src/app/globals.css` is the app brand override layer.
- `src/landing-static/shared/css/landing.bridge.css` is the semantic bridge between DS tokens and product landing tokens.
- Required `--ds-*` foundations: colors, base font family, font scale, line heights, spacing, radii, shadows, z-index, breakpoints, container width, and minimum touch target.
- In the app, `--ds-color-*` maps to `--cw-*` brand tokens; the non-brand scales stay stable and should not drift without a deliberate contract change.

## Semantic Migration Plan

- Completed: expert blocks now use semantic-only classes (`section-expert-grid`, `section-expert-text`, `section-expert-image`, `section-expert-text-content`) and legacy `s55-*` is removed from target HTML/CSS.
- Guarded: `guard:ds-contract` fails if legacy expert class/id (`s55-grid|s55-text|s55-image|divs55`) appears again.

## Auth and users foundation

- `docs/migration/sql/2026-04-01_platform_users_google_auth.sql` creates platform-wide `platform_users` linked to `auth.users` (not test-specific).
- `POST /api/platform/users/sync` upserts current authenticated user profile (Google metadata supported).
- `/dosha-test` opens without auth, but requests Google sign-in only after the user clicks start; after sign-in it syncs the platform profile and resumes the test launch.
- Protected generated routes are configured centrally in `src/lib/auth/protectedRoutes.ts` (currently none).
