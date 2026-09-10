-- CenterWay: enforce security_invoker on dosha test profile views (P0-A security gate).
--
-- Supabase advisor flags these as CRITICAL "Security Definer View":
--   public.v_user_latest_test_attempts
--   public.v_user_dosha_test_profile
--
-- Root cause: the 2026-04-03 dosha cutover recreated both views with
-- CREATE OR REPLACE VIEW *without* `WITH (security_invoker = on)`, so they reverted
-- to the Postgres default (run with the view owner's privileges), bypassing the RLS
-- of the querying user — the same flaw the 2026-04-01 migration had already fixed.
--
-- Fix: flip them back to security_invoker so they respect the caller's RLS on
-- test_attempts / test_definitions. Bodies are unchanged.
--
-- Safety: additive, idempotent. App reads use the service role (bypasses RLS), so
-- behaviour is unchanged; this only tightens access for anon/authenticated callers.

begin;

alter view public.v_user_latest_test_attempts set (security_invoker = on);
alter view public.v_user_dosha_test_profile set (security_invoker = on);

commit;

-- Verification (manual):
--   select c.relname, (c.reloptions::text) as opts
--   from pg_class c
--   where c.relname in ('v_user_latest_test_attempts', 'v_user_dosha_test_profile');
--   -- expect opts to contain security_invoker=on
