# Local development without OrbStack

2026-10-06. Replaces the Docker launch instructions in `local-stack-2026-09-10.md`.

## Runtime

`npm run db:local:up` uses Supabase CLI **2.119.0**, pinned inside the ignored
`.local/bin/` directory. The first preparation downloads the official Apple
Silicon archive and verifies its SHA-256 against the release checksums before
extracting the executable. It does not replace the globally installed CLI.

The CLI runs its experimental **native** stack, explicitly selected so there
is no fallback to Docker or Podman. Postgres, Auth, REST and Storage remain
available. Realtime, Functions, Studio, mail, analytics and the pooler are
excluded. Services start on demand and can stop when idle; the launcher does
not use `--eager`. This removes the Linux VM from the usual UI development path.

The generated config and runtime state live under ignored `.local/`. The
generated config retains the project's fixed loopback API/database ports,
disables automatic migration/seed replay and unsupported vector storage, and
sets Auth redirects to port 8000. `scripts/db-local.mjs` remains responsible
for loading the committed schema, content and fictional accounts and rehearsing
pending migrations against populated tables.

## Commands

```sh
npm run db:local:prepare   # install the pinned CLI and prepare config
npm run db:local:up        # start native services; never starts OrbStack
npm run db:local:runtime   # runtime/services/endpoints; omits exported keys
npm run db:local:reset     # rebuild ONLY the fixed local database from snapshots
npm run db:local:env       # point Next at the local native API
npm run smoke:local:native # Auth/REST and disposable Storage upload/read/delete
npm run dev               # localhost:8000
npm run db:local:down      # stop native services, retain database files
```

`db:local:sync` still only reads production content/schema. Production customer
data stays out of the local snapshots. `db:local:env:off` is not a fallback for
a stopped runtime: it points development at production.

## Transition and limits

The old Docker volumes remain untouched. Native data is separate; the CLI does
not automatically convert or copy Docker data. Restore the committed snapshots
into the fresh native database, not into the old Docker volume. Any unpublished
content that exists only in Docker needs an explicit export before retirement.
The launcher saves the stack identity per checkout, so changing Git branches
does not silently create another native database on the same fixed ports.

The native runtime and its flags are experimental. The supported target for
this project launcher is Apple Silicon macOS. `.local/` contains database data
and credentials and must not be committed or casually deleted. The project's
`clean` command does not remove it.

Verified during transition: restoring 8 courses and rehearsing 23 pending
migrations, signing in as a fictional author, reading the course in Builder,
opening version history, and generating TypeScript schema types with native
postgres-meta. `npm run db:types` now also uses the pinned native CLI.
The generated type file was not replaced as part of this runtime-only change.
The loopback-only smoke also verified upload/read/delete of a temporary PNG in
`course-media`. The reset loader restores the bucket and its public-read policy
from the existing idempotent Storage migration, because public-only snapshots
do not contain Storage configuration.

Sources: [native runtime](https://supabase.com/docs/guides/local-development/docker-and-native-runtimes),
[experimental stack commands](https://supabase.com/docs/guides/local-development/running-multiple-local-projects).
