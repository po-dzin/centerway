-- LMS: idempotency log for "you bought this and never opened it" nudges.
--
-- Why a separate table from `lms_reminder_log`: that one is keyed on
-- (enrollment_id, day_number, channel) and its columns are NOT NULL, because a
-- day-N reminder is meaningless without an enrollment. The learners this nudge
-- targets have NO enrollment row at all — `ensureEnrollment` only runs when a
-- course is first opened, which is precisely the thing they have not done.
-- Widening the existing table would make half its columns nullable and blur
-- what a row means; a different fact gets a different table.
--
-- The natural key is the ORDER: one purchase, one nudge sequence.
--
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.lms_unstarted_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Not an FK: `orders.order_ref` is the purchase currency across the funnel
  -- and stays stable, while the row it points at may be re-keyed by provider
  -- reconciliation. Matching the looseness the rest of the LMS uses for orders.
  order_ref text NOT NULL,
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL,
  -- 1-based position in UNSTARTED_NUDGE_DAYS (src/lms-core/schedule.ts).
  nudge_number integer NOT NULL CHECK (nudge_number > 0),
  channel text NOT NULL DEFAULT 'telegram',
  sent_at timestamptz NOT NULL DEFAULT now(),
  -- One nudge per purchase per position, whatever the cron cadence.
  UNIQUE (order_ref, nudge_number, channel)
);

CREATE INDEX IF NOT EXISTS idx_lms_unstarted_reminders_user
  ON public.lms_unstarted_reminders (auth_user_id);

ALTER TABLE public.lms_unstarted_reminders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Service-role only for writes; staff may read it for support.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lms_unstarted_reminders' AND policyname = 'Admins can view unstarted reminders'
  ) THEN
    EXECUTE $p$ CREATE POLICY "Admins can view unstarted reminders" ON public.lms_unstarted_reminders
      FOR SELECT USING (public.get_my_role() in ('admin', 'support')) $p$;
  END IF;
END $$;
