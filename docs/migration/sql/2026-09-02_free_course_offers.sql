-- Free course offers are explicit database state, not a missing price.
-- Apply in Supabase SQL Editor if the repository migration is not run by CI.
-- NULL / no row remains inquiry; amount = 0 grants platform access.

ALTER TABLE public.lms_course_offers
  DROP CONSTRAINT IF EXISTS lms_course_offers_amount_check;
ALTER TABLE public.lms_course_offers
  ADD CONSTRAINT lms_course_offers_amount_check CHECK (amount >= 0);

-- A struck-through price that is not above the charged price is not a discount.
-- Legacy rows predate the admin rule, so clear them before the constraint lands.
UPDATE public.lms_course_offers
  SET list_amount = NULL
  WHERE list_amount IS NOT NULL AND NOT (amount > 0 AND list_amount > amount);

ALTER TABLE public.lms_course_offers
  DROP CONSTRAINT IF EXISTS lms_course_offers_list_amount_check;
ALTER TABLE public.lms_course_offers
  ADD CONSTRAINT lms_course_offers_list_amount_check
  CHECK (list_amount IS NULL OR (amount > 0 AND list_amount > amount));

ALTER TABLE public.lms_enrollments
  DROP CONSTRAINT IF EXISTS lms_enrollments_source_check;
ALTER TABLE public.lms_enrollments
  ADD CONSTRAINT lms_enrollments_source_check
  CHECK (source IN ('order', 'token', 'manual', 'bonus', 'promotion', 'free'));

COMMENT ON COLUMN public.lms_course_offers.amount IS
  'Charged amount in whole currency units. 0 means free access; absence of an active offer means inquiry.';
