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
```

`smoke:admin:auth` requires `SMOKE_ADMIN_BEARER` and validates 200-contracts for core admin endpoints.
