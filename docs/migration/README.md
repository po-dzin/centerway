# Migrations — how a schema change reaches production

Written 2026-09-11, after an audit found a change live in production that this
folder did not mention. Its SQL was not lost — it sat in git history and in the
database's own history table, identical in both — but it was unfindable in the
one place people look, which is the same thing in practice.

The audit also got something wrong, which is worth keeping: run from a branch 47
commits behind `main`, it called a second migration missing when `main` had held
the file all along. Audit against `origin/main`, never against whatever happens
to be checked out.

## Three places, and only one of them is the record

| place | what it is | tracked in git |
|---|---|---|
| `docs/migration/sql/` | **the record.** Every schema change ever applied. | yes |
| `supabase/migrations/` | staging for the CLI. Holds ONE file at a time. | **no — gitignored** |
| `supabase_migrations.schema_migrations` (production) | what the database believes it has run. | n/a |

The record is the only durable one. `npm run db:stage` calls `clearStage()`
before every run, so the staging directory is emptied each time; anything whose
only copy lived there is gone the next time someone stages something else.

## The order

**1. Write the file first.** `docs/migration/sql/<YYYY-MM-DD>_<name>.sql`, with a
header saying what the change is for. Before applying anything. This is the whole
point of the rule — every failure found in the audit was "applied, then meant to
write it down."

**2. Rehearse locally.**

```
npm run db:stage -- <YYYY-MM-DD>_<name>
npm run db:local:reset
```

`db:stage` copies the canonical file into `supabase/migrations/` under a
CLI-shaped version stamp; `db:local:reset` loads production's schema and content
into the local stack and then runs the staged file against populated tables.

**3. Apply to production.** Through the Supabase SQL editor — see *Why `db push`
does not work* below.

**4. Record the version by hand**, so the history stays complete:

```sql
insert into supabase_migrations.schema_migrations (version) values ('<YYYYMMDD000000>');
```

The stamp is the one `db:stage` printed in step 2. Same-day migrations collide on
`YYYYMMDD000000`, so a second one that day takes `...010000`, a third `...020000`,
matching what is already in the table.

**5. Close the cycle.**

```
npm run check:migration-drift
```

It fails when production holds a version with no file in `docs/migration/sql/`.
That is the one thing it guards, and it is the one thing that actually went wrong.

## Why `db push` does not work

`supabase db push` compares the local folder with the remote history and refuses
when remote holds versions the folder does not. Staging holds one file by design,
so all 76 remote versions always look missing. This is structural, not a passing
fault — it has been true since at least 2026-08-22.

**Do not run the fix the CLI suggests.** `supabase migration repair --status
reverted <76 versions>` marks 76 applied migrations as reverted. That is a lie
written into the history table, and the next push would try to run them all.

## What the guard cannot see

It compares the history table with this folder. It does **not** compare the
schema with either. A change made in the SQL editor whose version was never
recorded is invisible to it — the database has the change, the history does not
mention it, and nothing disagrees. Step 4 is what keeps that from happening, and
nothing automated is behind it.

## Known fragile: six migrations whose only copy is this folder

These were applied with no statements stored in the history table (the signature
of the SQL editor plus a hand-written version row). For them, the file in
`docs/migration/sql/` is the only copy of the SQL that exists anywhere:

```
20260822000000  lms_course_storefront
20260822010000  course_media_bucket
20260829000000  lms_author_founder_publish
20260829010000  lms_author_founder_link_user
20260902000000  free_course_offers
20260910000000  lead_stage
```

`check:migration-drift` prints this list on every run so it stays visible. For
every one of them, losing the repo file means losing the SQL: the history table
has the version and the name, and nothing else.

## Open decision: move to real `db push`

The reason this project uses staging has expired. `scripts/db-stage-migration.mjs`
was built when production had no migration history, so pushing the whole folder
would have re-run everything. Production now has 76 recorded versions, and
`db push` only applies what is absent from that table — its own `--include-all`
flag is documented as "Include all migrations **not found on remote history
table**". Nothing would be re-run.

Switching would mean: un-gitignore `supabase/migrations/`, place all 76 files
there under their real version stamps, and run `supabase migration repair
--status applied <76 versions>` — a bookkeeping write that marks without
executing. After that the manual steps 3 and 4 disappear, production stores the
statements itself, and this folder stops being the only copy of anything.

It has a cost that is easy to miss: `db-local.mjs reset` runs every file in
`supabase/migrations/` after loading the production dump. With one staged file
that is harmless; with 76 it is not, because roughly 30 of them are not safe to
re-run against a schema that already has them (23 `create policy` with no
matching `drop policy`, 6 `insert` with no `on conflict`, and one each of
`create type`, `create table` and `add column` without a guard — counted by
pattern, not by running them). So the switch has to fix the local reset in the
same change, or it repairs production and breaks everyone's development.

Decided 2026-09-11: not now. Write the file first, keep the guard, revisit this
as its own slice.
