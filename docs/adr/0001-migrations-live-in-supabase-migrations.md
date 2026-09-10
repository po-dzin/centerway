# 0001 — The schema record is `supabase/migrations/`, journaled in production

2026-09-10. Status: accepted.

## Context

Two histories existed: 76 SQL files under `docs/migration/sql/`, applied by
hand and mostly unregistered, and a gitignored staging queue in
`supabase/migrations/` fed by a script. The production journal
(`supabase_migrations.schema_migrations`) knew 29 of the 76; 47 had been
applied and never registered, two had never been applied. Nobody could say
from the repository what the database looked like.

## Decision

`supabase/migrations/` is the record and is committed. Every file there has a
journal row and every journal row has a file; reconciled on 2026-09-10 by
checking each file's objects against production. A change is a new file,
applied with `npm run db:push` through the session pooler, and the generated
`src/lib/db/database.types.ts` is regenerated and committed with it. A
statement typed into the SQL editor and nowhere else is not a migration.
Two files were declined rather than applied and sit in
`docs/migration/declined/` with the reason.

## Consequences

The repository is again a description of the database. The price is that
the journal must be written by hand when `psql` is used instead of the push
script, and that `db:types` needs Docker. Procedure and the two declined
files: [migration/README.md](../migration/README.md).
