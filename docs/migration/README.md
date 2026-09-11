# Migrations — how a schema change reaches production

**The canon is `supabase/migrations/`.** One file per change, named
`YYYYMMDDHHMMSS_name.sql`, and the journal that says what production has is
`supabase_migrations.schema_migrations`. Since 2026-09-10 the two agree: every
file in the folder has a journal row, every journal row has a file. The decision
and its price are in
[ADR-0001](../adr/0001-migrations-live-in-supabase-migrations.md).

Until that day the record lived in `docs/migration/sql/` (76 files), and
`supabase/migrations/` was a gitignored staging queue that
`scripts/db-stage-migration.mjs` filled one file at a time. The journal held
29 of the 76; the other 47 had been applied by hand and never registered, and
two had never been applied at all. Reconciled by checking each file's objects
and effects against production, then journaling what was there. The staging
queue and its script are gone: a directory emptied on every run is where a
change goes to become unfindable.

## Applying a change

1. **Write the file first**, before applying anything:
   `supabase/migrations/<stamp>_<name>.sql`. Idempotent — `IF NOT EXISTS`,
   guarded `DO $$` blocks — so a re-run is harmless. Every failure the
   2026-09-11 audit found was "applied, then meant to write it down".
2. Rehearse: `npm run db:local:reset` loads production's schema and content into
   the local stack and runs the pending files against populated tables.
3. `npm run db:push:dry`, then `npm run db:push`. Both go through the session
   pooler (`scripts/lib/db-url.mjs`); the direct host is IPv6-only from here.
4. If you applied it with `psql` or the SQL editor instead, register it in the
   journal yourself. A file the journal does not know about is a file the next
   push runs again:

   ```sql
   insert into supabase_migrations.schema_migrations (version) values ('<stamp>');
   ```

   The stamp in the row and the stamp in the filename are the same string. That
   identity is what the guard below compares.
5. `npm run db:types` (needs Docker) and commit the regenerated types with the
   migration.
6. Close the cycle: `npm run check:migration-drift`.

## The guard

```
npm run check:migration-drift
```

`scripts/check-migration-drift.mjs` reads the production journal over `pg` and
fails when a version live in production has no SQL file in
`supabase/migrations/`. That is the one thing it guards, and it is the one thing
that actually went wrong. It needs database credentials and a network, so it is
not part of `lms:qa` or any gate that runs without secrets — run it deliberately.

It was written on 2026-09-11 after an audit found `author_profile_background` —
applied 2026-08-29, its SQL committed into the staging queue and deleted along
with it two weeks later. The text was never lost: it sat in git history and in
the journal's `statements` column, identical in both. It was simply unfindable
in the one place people look, which in practice is the same thing.

The audit also got something wrong, which is worth keeping: run from a branch 47
commits behind `main`, it called a second migration missing when `main` had held
the file all along. The guard now warns when the checkout is behind
`origin/main`. Audit from an up-to-date checkout, never from whatever happens to
be sitting in the tree.

**What fails:** a journal version with no file. Nothing else exits non-zero.

**What is reported but does not fail:** a file with no journal row; a file
renamed since it was applied; two files sharing one version stamp; a version
applied with no stored statements — the signature of the SQL editor plus a
hand-written version row, which means the repo file is the only copy of that SQL
anywhere. The guard prints that last list on every run so it stays visible.

Matching is **by version**, not by name. Under the old scheme a staged file's
stamp was derived from its date alone, so same-day migrations collided and the
name had to carry the identity; under ADR-0001 the filename carries the journal
version verbatim, which is the key the journal is keyed on. A journal row
registered by hand can have an empty `name`, so a name is not a key.

## What the guard cannot see

It compares the journal with the folder. It does **not** compare either with the
actual schema. A change made in the SQL editor whose version was never recorded
is invisible to it — the database has the change, the journal does not mention
it, and nothing disagrees. Step 4 above is what keeps that from happening, and
nothing automated is behind it.

## `declined/`

Migrations that were written and never applied, and on 2026-09-11 were decided
against rather than left as a queue. They sit outside the canon on purpose: a
prepared-but-unapplied file inside `supabase/migrations/` is a file `db:push`
will eventually run.

- `2026-04-07_parametric_experiments_foundation.sql` — four tables no code
  reads; the experiments the proxy runs come from the registry in
  `src/lib/generator`. Not needed.
- `2026-08-31_reset_day_title_dedup.sql` — trims the reset-day title that
  still carries its own posttitle. Since 2026-08-26 the offer surface derives
  the subtitle itself (`offerSubtitle`, `posttitle` first), so nothing on
  the storefront shows the duplicate; the long title in the row is cosmetic.
  Applying it is harmless and buys nothing, so it was not applied.

Kept as files rather than deleted so the next person who wonders finds the
answer here instead of rewriting the migration.

## Local stack

`scripts/db-local.mjs` (on its own branch as of 2026-09-10) replays every file
in `supabase/migrations/` as "pending" after restoring the production dump.
With the canon in that folder it needs to skip what the dump's journal already
has, or it will re-run 75 files — most idempotent, the backfills not.
