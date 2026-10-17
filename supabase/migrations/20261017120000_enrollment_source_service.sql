-- 2026-10-17 · «Службовий» — a fourth reason to hand a seat out
--
-- The unified grant dialog asks "why does this person have this?" with four
-- answers: paid outside the provider (`manual`), a gift (`bonus`), a promo
-- (`promotion`) and now a staff seat (`service`) — a colleague, a reviewer, a
-- tester. Until now the last one had to be filed as `bonus` with a note in a
-- chat, and a year later the gift list and the staff list were the same list.
--
-- Only the CHECK widens; no row changes. `order` and `token` stay purchase-only
-- (the checkout writes them), and `lms-core`'s entitlement treats any
-- non-purchase source as an admin grant, so a `service` seat opens the course
-- exactly as a `bonus` one does.
--
-- ROLLBACK (only while no row holds 'service'):
--   ALTER TABLE public.lms_enrollments DROP CONSTRAINT IF EXISTS lms_enrollments_source_check;
--   ALTER TABLE public.lms_enrollments ADD CONSTRAINT lms_enrollments_source_check
--     CHECK (source IN ('order', 'token', 'manual', 'bonus', 'promotion'));

ALTER TABLE public.lms_enrollments DROP CONSTRAINT IF EXISTS lms_enrollments_source_check;
ALTER TABLE public.lms_enrollments ADD CONSTRAINT lms_enrollments_source_check
  CHECK (source IN ('order', 'token', 'manual', 'bonus', 'promotion', 'service'));
