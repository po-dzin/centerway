-- Every "has this already been sent?" check reads a whole table.
--
-- The checkout start (src/app/api/orders/create, src/lib/paymentStart.ts), the
-- WayForPay webhook, the jobs worker and the purchase backfill all ask
-- `jobs` / `events` with PostgREST `.contains("payload", {...})`, i.e.
-- `payload @> '{...}'`. Neither table had an index that operator can use, so
-- each call scanned every row and detoasted every payload. Measured on
-- production 2026-09-13 (pg_stat_statements since 2026-01-27): the idempotency
-- lookup on `jobs` averaged 405 ms over 4 617 calls, and `jobs` + `events`
-- together had been seq-scanned for 404 M tuples. The cost grows with the
-- tables, not with traffic, so it would have kept getting slower on the
-- checkout path at any compute size.
--
-- `jsonb_path_ops` rather than the default `jsonb_ops`: smaller and faster, and
-- `@>` is the only operator the code uses against `payload` (checked: no
-- `payload->>` filters, no `?` / `?|` key-existence queries).
--
-- `events (type, created_at)`: the admin analytics and pulse reads filter by
-- `type` and a `created_at` window and order by `created_at desc` — up to
-- 755 ms per call with only `order_ref` and the primary key indexed.
--
-- Plain CREATE INDEX, not CONCURRENTLY: CONCURRENTLY cannot run inside a
-- transaction, and both the local rehearsal and `psql --single-transaction`
-- wrap the file in one. The tables are 27 MB and 37 MB; the build holds a
-- write lock for about a second, and inserts to `events` / `jobs` wait for it
-- rather than fail.

CREATE INDEX IF NOT EXISTS jobs_payload_gin
  ON public.jobs USING gin (payload jsonb_path_ops);

CREATE INDEX IF NOT EXISTS events_payload_gin
  ON public.events USING gin (payload jsonb_path_ops);

CREATE INDEX IF NOT EXISTS events_type_created_at_idx
  ON public.events (type, created_at DESC);

ANALYZE public.jobs;
ANALYZE public.events;
