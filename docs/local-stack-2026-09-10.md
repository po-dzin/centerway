# The local stack, and the rhythm it replaces

2026-09-10

## What was wrong

There was one database. `npm run dev` on port 8000 read and wrote the same rows
customers were reading, so the only place a change could be judged safely was a
deployment. That is how a working day turned into a deploy every half hour, a
pull request per idea, and a Vercel account pressed against its limits.

The deploys were never the point. They were a symptom of having nowhere else to
look.

## What exists now

A full Supabase stack on this machine — Postgres on 54322, the API on 54321,
Studio on 54323 — carrying production's **shape** and production's **content**,
with **invented people**.

That three-way split is the whole design, and it is deliberate:

| | source | why |
|---|---|---|
| shape | `pg_dump` of `public`, schema only | Real constraints, real RLS, real triggers. A migration that fails here fails in production. |
| content | courses, lessons, offers, test questions, authors | A storefront full of invented courses proves nothing about layout, slugs, or the contract ceiling. None of these tables hold personal data. |
| people | hand-written in `supabase/local/040_people.sql` | Customer emails and payment records have no business on a laptop or in a git history, and no checkout bug needs them to be real. |

The people are one of each *shape* rather than many of each kind: an admin, a
student whose access is live, a student whose access ran out yesterday, and a
stranger. Password for all of them is `local-dev`.

- `admin@local.test` — admin role, sees the admin app
- `student@local.test` — paid, enrolled, access live
- `expired@local.test` — paid once, `expires_at` in the past
- `author1@local.test`, `author2@local.test` — the accounts the seeded courses
  belong to, re-created under production's ids so the foreign keys resolve

## The commands

```
npm run db:local:up        # start the containers (first run pulls images)
npm run db:local:sync      # production -> supabase/local/*.sql   (read-only)
npm run db:local:reset     # supabase/local/*.sql -> local postgres
npm run db:local:env       # point `npm run dev` at the local stack
npm run db:local:env:off   # point it back at production
npm run db:local:status    # what is up, and which database dev is talking to
npm run db:rehearse        # reset + lms:validate + build
```

`db:local:env` works by writing `.env.development.local`, which Next reads ahead
of `.env.local`. Its presence *is* the switch; nothing else in the repo knows
about it, and `db:local:status` always says out loud which database `npm run dev`
will reach. Check that before wondering why a row did not change.

## The order of assembly, which is not the obvious one

`reset` loads: shape → accounts → content → people → `supabase/migrations/*.sql`.

The pending migration runs **last, against populated tables**. In production it
will also meet a full database, so a backfill that silently does nothing against
empty tables, or a `NOT NULL` that only fails once rows exist, has to fail here
first. Running migrations before the data — the intuitive order — would hide
exactly the class of failure this stack exists to catch.

## Migrating, from now on

1. Write the SQL in `docs/migration/sql/` — still the canonical record.
2. `npm run db:stage <name>` — one file at a time into `supabase/migrations/`.
   `db push` applies **every** file in that folder, which is why staging is
   deliberate and singular.
3. `npm run db:rehearse` — rebuild locally with the migration on top of real
   content, then validate and build.
4. Only then `npm run db:push`.

## Two things that will bite

**`supabase/local/010_schema.sql` is production as of the day it was synced, not
as of the migration log.** `docs/**` has drifted from production before; the only
honest record of what is applied is `supabase_migrations.schema_migrations` on
the remote. Re-run `db:local:sync` after every production migration, or the local
rehearsal is against yesterday's shape.

**`sync` reaches production through the session pooler**, rebuilt from
`SUPABASE_DB_URL` inside `scripts/db-local.mjs`. The direct `db.<ref>` host that
variable names is IPv6-only and unreachable from this machine; do not "fix" the
rewrite by pointing it back at the direct host.

## What the local stack still cannot answer

- WayForPay callbacks and the Telegram webhook — they need a public address. A
  tunnel to port 8000 plus re-pointing the webhook covers it; a deployment does
  not have to.
- `pg_cron` and `pg_net`: the scheduling functions come across in the schema dump
  and create cleanly, but nothing fires locally. Cron behaviour is still verified
  against production.
- Anything about real traffic — Meta attribution, actual conversion. Those live
  in production by definition.

Everything else — layout, routes, the builder, the shelf, checkout up to the
redirect, roles, RLS, and every migration — belongs here now.

See also the Publish Rhythm Rule in `AGENTS.md`, which is the half of this change
that is not code.
