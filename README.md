# CenterWay Platform

Unified runtime for both CenterWay product funnels:
- `reboot.centerway.net.ua` -> **Short Reboot**
- `irem.centerway.net.ua` -> **IREM Gymnastics**

Both funnels share API/runtime and keep isolated landing journeys (no cross-navigation).

## Repo layout

- `platform` - Next.js app (API, host-based routing, static landing hosting)
- `docs/migration` - cutover notes and checks

Legacy source repos can stay locally as snapshots (`centerway-backend`, `irem-gym`, `short-reboot-main`), but they are excluded from git in this monorepo.

## Commands

```bash
npm run dev
npm run lint
npm run build
npm run smoke
npm run userflows
```
