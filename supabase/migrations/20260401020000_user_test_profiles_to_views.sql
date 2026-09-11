-- CenterWay: replace user_test_profiles with read views (Option 2)
-- Run in Supabase SQL editor (public schema).

BEGIN;

-- 1) Performance index for "latest completed attempt per user/test" queries.
CREATE INDEX IF NOT EXISTS idx_test_attempts_user_test_completed_desc
  ON public.test_attempts (user_id, test_id, completed_at DESC, created_at DESC)
  WHERE status = 'completed' AND user_id IS NOT NULL;

-- 2) Generic latest-result view for any test.
--    One row per (user_id, test_id): latest completed attempt.
CREATE OR REPLACE VIEW public.v_user_latest_test_attempts
WITH (security_invoker = on)
AS
SELECT DISTINCT ON (qa.user_id, qa.test_id)
  qa.user_id,
  qa.test_id,
  qa.id AS attempt_id,
  qa.result_type,
  qa.score_vata,
  qa.score_pitta,
  qa.score_kapha,
  qa.completed_at,
  qa.version,
  qa.created_at
FROM public.test_attempts qa
WHERE qa.status = 'completed'
  AND qa.user_id IS NOT NULL
ORDER BY qa.user_id, qa.test_id, qa.completed_at DESC NULLS LAST, qa.created_at DESC;

-- 3) Dosha-specific convenience view.
CREATE OR REPLACE VIEW public.v_user_dosha_test_profile
WITH (security_invoker = on)
AS
SELECT
  v.user_id,
  v.test_id,
  qd.slug AS test_slug,
  v.attempt_id,
  v.result_type,
  v.score_vata,
  v.score_pitta,
  v.score_kapha,
  v.completed_at,
  v.version
FROM public.v_user_latest_test_attempts v
JOIN public.test_definitions qd ON qd.id = v.test_id
WHERE qd.slug = 'dosha-test';

-- 4) Optional final cleanup (run only after API code no longer writes to user_test_profiles):
-- DROP TABLE IF EXISTS public.user_test_profiles;

COMMIT;
