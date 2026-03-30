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
npm run smoke:admin
npm run smoke:admin:auth
npm run smoke:admin:authz-surface
npm run smoke:admin:funnel
npm run smoke:admin:payload-contracts
npm run smoke:admin:write-guards
npm run smoke:admin:authz-coverage
```

`smoke:admin:auth` requires `SMOKE_ADMIN_BEARER` and validates 200-contracts for core admin endpoints.
`smoke:admin:funnel` requires `SMOKE_ADMIN_BEARER` and validates analytics invariants (funnel/CAPI consistency).
`smoke:admin:payload-contracts` validates error/payload contracts for admin mutate endpoints.
`smoke:admin:write-guards` optionally uses `SMOKE_USER_BEARER` to assert strict `403` on mutate endpoints for non-admin users.
