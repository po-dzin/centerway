-- CenterWay: full cutover from quiz_* to test_* (no legacy)
-- Assumption: no production users depend on old contracts.

BEGIN;

-- 1) Core table renames
ALTER TABLE IF EXISTS public.quiz_definitions RENAME TO test_definitions;
ALTER TABLE IF EXISTS public.quiz_questions RENAME TO test_questions;
ALTER TABLE IF EXISTS public.quiz_options RENAME TO test_options;
ALTER TABLE IF EXISTS public.quiz_attempts RENAME TO test_attempts;
ALTER TABLE IF EXISTS public.quiz_answers RENAME TO test_answers;

-- 2) Core column renames
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'test_questions' AND column_name = 'quiz_id'
  ) THEN
    ALTER TABLE public.test_questions RENAME COLUMN quiz_id TO test_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'test_attempts' AND column_name = 'quiz_id'
  ) THEN
    ALTER TABLE public.test_attempts RENAME COLUMN quiz_id TO test_id;
  END IF;
END $$;

-- 3) Drop optional legacy profile table
DROP TABLE IF EXISTS public.user_quiz_profiles;

-- 4) Rename update-timestamp function and triggers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'quiz_set_updated_at'
  ) THEN
    ALTER FUNCTION public.quiz_set_updated_at() RENAME TO test_set_updated_at;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_quiz_definitions_updated_at') THEN
    ALTER TRIGGER trg_quiz_definitions_updated_at ON public.test_definitions RENAME TO trg_test_definitions_updated_at;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_quiz_questions_updated_at') THEN
    ALTER TRIGGER trg_quiz_questions_updated_at ON public.test_questions RENAME TO trg_test_questions_updated_at;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_quiz_options_updated_at') THEN
    ALTER TRIGGER trg_quiz_options_updated_at ON public.test_options RENAME TO trg_test_options_updated_at;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_quiz_attempts_updated_at') THEN
    ALTER TRIGGER trg_quiz_attempts_updated_at ON public.test_attempts RENAME TO trg_test_attempts_updated_at;
  END IF;
END $$;

-- 5) Rebuild indexes with test_* names
DROP INDEX IF EXISTS public.idx_quiz_attempts_status;
DROP INDEX IF EXISTS public.idx_quiz_attempts_user_id;
DROP INDEX IF EXISTS public.idx_quiz_attempts_quiz_id;
DROP INDEX IF EXISTS public.idx_quiz_attempts_last_activity_at;
DROP INDEX IF EXISTS public.idx_quiz_attempts_result_type;
DROP INDEX IF EXISTS public.idx_quiz_answers_attempt_id;
DROP INDEX IF EXISTS public.idx_quiz_answers_question_id;
DROP INDEX IF EXISTS public.idx_quiz_attempts_user_quiz_completed_desc;

CREATE INDEX IF NOT EXISTS idx_test_attempts_status ON public.test_attempts(status);
CREATE INDEX IF NOT EXISTS idx_test_attempts_user_id ON public.test_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_test_id ON public.test_attempts(test_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_last_activity_at ON public.test_attempts(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_test_attempts_result_type ON public.test_attempts(result_type);
CREATE INDEX IF NOT EXISTS idx_test_answers_attempt_id ON public.test_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_test_answers_question_id ON public.test_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_user_test_completed_desc
  ON public.test_attempts (user_id, test_id, completed_at DESC, created_at DESC)
  WHERE status = 'completed' AND result_type IS NOT NULL;

-- 6) Recreate views with test_* naming
DROP VIEW IF EXISTS public.v_user_dosha_profile;
DROP VIEW IF EXISTS public.v_user_latest_quiz_attempts;

CREATE OR REPLACE VIEW public.v_user_latest_test_attempts AS
SELECT DISTINCT ON (ta.user_id, ta.test_id)
  ta.user_id,
  ta.test_id,
  ta.id AS attempt_id,
  ta.result_type,
  ta.score_vata,
  ta.score_pitta,
  ta.score_kapha,
  ta.completed_at,
  ta.version,
  ta.created_at
FROM public.test_attempts ta
WHERE ta.user_id IS NOT NULL
  AND ta.status = 'completed'
  AND ta.result_type IS NOT NULL
ORDER BY ta.user_id, ta.test_id, ta.completed_at DESC NULLS LAST, ta.created_at DESC;

CREATE OR REPLACE VIEW public.v_user_dosha_test_profile AS
SELECT
  v.user_id,
  v.test_id,
  td.slug AS test_slug,
  v.attempt_id,
  v.result_type,
  v.score_vata,
  v.score_pitta,
  v.score_kapha,
  v.completed_at,
  v.version
FROM public.v_user_latest_test_attempts v
JOIN public.test_definitions td ON td.id = v.test_id
WHERE td.slug = 'dosha-test';

-- 7) Data canonicalization
UPDATE public.test_definitions
SET slug = 'dosha-test',
    title = 'Dosha Test'
WHERE slug IN ('dosha-quiz', 'dosha-test');

UPDATE public.events
SET type = replace(type, 'dosha_quiz_', 'dosha_test_')
WHERE type LIKE 'dosha_quiz_%';

UPDATE public.platform_users
SET onboarding_state = 'test_completed'
WHERE onboarding_state = 'quiz_completed';

ALTER TABLE public.platform_users DROP CONSTRAINT IF EXISTS platform_users_onboarding_state_check;
ALTER TABLE public.platform_users
  ADD CONSTRAINT platform_users_onboarding_state_check
  CHECK (onboarding_state IN ('new', 'profile_completed', 'test_completed', 'active'));

UPDATE public.customers
SET tags = array_replace(tags, 'quiz_completed', 'test_completed')
WHERE tags @> ARRAY['quiz_completed'];

COMMIT;
