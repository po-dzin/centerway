# CenterWay Monorepo

Unified platform for CenterWay products:
- platform app (API + host-based frontend routing)
- shared packages and configs
- migration docs

Legacy source repositories are preserved locally and imported into this monorepo with history.

## Layout

- `apps/platform` — Next.js runtime (API + host routing + legacy static hosting)
- `apps/legacy/irem-site` — imported IREM history snapshot
- `apps/legacy/short-site` — imported Short history snapshot
- `packages/shared` — shared platform types/interfaces
- `docs/migration` — migration and cutover runbooks
