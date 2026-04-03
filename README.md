# CenterWay Platform App

Next.js runtime for:
- host-based landing routing (`reboot.*` and `irem.*`)
- payment API endpoints
- static landing assets under `public/*`

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

## Auth and users foundation

- `docs/migration/sql/2026-04-01_platform_users_google_auth.sql` creates platform-wide `platform_users` linked to `auth.users` (not test-specific).
- `POST /api/platform/users/sync` upserts current authenticated user profile (Google metadata supported).
- `/dosha-test` includes Google sign-in prompt and securely attaches anonymous attempt to authenticated user via bearer token.
