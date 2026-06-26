-- CenterWay: enable RLS on public.leads (P0-A security gate).
-- The leads table holds PII (name / email / phone) captured pre-checkout but was
-- created (2026-02-17) without row level security, unlike orders/payments/events.
--
-- Safety:
-- 1) Additive + idempotent.
-- 2) No policies are added => anon and authenticated roles get NO access.
-- 3) All app reads/writes use the service role (supabaseAdmin / adminClient),
--    which bypasses RLS, so enabling this does not change app behaviour.

begin;

alter table public.leads enable row level security;

-- Defense in depth: also force RLS so even the table owner is subject to policies
-- (service role still bypasses RLS entirely).
alter table public.leads force row level security;

commit;

-- Verification (manual):
--   select relrowsecurity, relforcerowsecurity
--   from pg_class where relname = 'leads';  -- expect (t, t)
