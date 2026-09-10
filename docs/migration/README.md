# Migrations

**The canon is `supabase/migrations/`.** One file per change, named
`YYYYMMDDHHMMSS_name.sql`, and the journal that says what production has is
`supabase_migrations.schema_migrations`. Since 2026-09-10 the two agree: every
file in the folder has a journal row, every journal row has a file.

Until that day the record lived here, in `docs/migration/sql/` (76 files), and
`supabase/migrations/` was a gitignored staging queue that
`scripts/db-stage-migration.mjs` filled one file at a time. The journal held
29 of the 76; the other 47 had been applied by hand and never registered, and
two had never been applied at all. Reconciled by checking each file's objects
and effects against production, then journaling what was there.

## Applying a change

1. Write `supabase/migrations/<stamp>_<name>.sql`. Idempotent — `IF NOT EXISTS`,
   guarded `DO $$` blocks — so a re-run is harmless.
2. `npm run db:push:dry`, then `npm run db:push`. Both go through the session
   pooler (`scripts/lib/db-url.mjs`); the direct host is IPv6-only from here.
3. If you applied it with `psql` instead, register it in the journal yourself.
   A file the journal does not know about is a file the next push runs again.
4. `npm run db:types` (needs Docker) and commit the regenerated types with the
   migration.

## `pending/`

Migrations that exist and were never applied. Each is a decision, not a queue:

- `2026-04-07_parametric_experiments_foundation.sql` — four tables no code
  reads. The experiments the proxy runs come from a registry in
  `src/lib/generator`, not from the database. Probably to delete.
- `2026-08-31_reset_day_title_dedup.sql` — trims the reset-day title that still
  carries its own posttitle. Its `WHERE` matches production exactly as of
  2026-09-10, so applying it would take effect. Content change on a live
  course: the owner's call.

## Local stack

`scripts/db-local.mjs` (on its own branch as of 2026-09-10) replays every file
in `supabase/migrations/` as "pending" after restoring the production dump.
With the canon in that folder it needs to skip what the dump's journal already
has, or it will re-run 75 files — most idempotent, the backfills not.
