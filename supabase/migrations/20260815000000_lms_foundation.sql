-- CenterWay: LMS foundation (H1 "склад курсов")
-- Run in Supabase SQL editor (public schema).
-- Plan: docs/lms-research-2026-08-15.md  |  Core: src/lms-core/**
--
-- Design notes:
--  * Lesson bodies are JSONB block arrays, validated in src/lms-core/blocks.ts.
--    Blocks are always read and written whole, so normalizing them buys nothing
--    and would cost the builder (H2) and the agent (H3) a join per edit.
--  * Progress is an append-only EVENT LOG, not mutable state. That keeps offline
--    sync (native, H4) an idempotent replay instead of a merge. Current state is
--    folded in src/lms-core/progress.ts.
--  * Locale / translation_group_id / notification_channels are SLOTS for the EN
--    expansion (docs §3A) — nothing populates them beyond uk/ru + telegram today.

-- ─────────────────────────────────────────
-- 1. Learner-side profile slots
-- ─────────────────────────────────────────
-- Timezone is NOT a slot: drip and reminders are wrong without it from day one.
ALTER TABLE public.platform_users
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Kyiv';

ALTER TABLE public.platform_users
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'uk';

-- Delivery channels for reminders. Only 'telegram' is implemented on H1;
-- 'email' and 'webpush' ship with the EN expansion / PWA.
ALTER TABLE public.platform_users
  ADD COLUMN IF NOT EXISTS notification_channels text[] NOT NULL DEFAULT ARRAY['telegram']::text[];

-- ─────────────────────────────────────────
-- 2. Courses
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lms_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  -- Catalog program this course delivers (src/lib/platform/content.ts).
  program_slug text NOT NULL,
  -- Author brand: courses stay isolated per author (multi-author hub).
  brand text NOT NULL DEFAULT 'centerway',
  locale text NOT NULL DEFAULT 'uk' CHECK (locale IN ('uk', 'ru', 'en')),
  -- Groups translations of the same course; EN versions never block the UK one.
  translation_group_id text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  -- Bumped on every content change so clients can cache lesson bodies hard.
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  summary jsonb NULL,
  schedule jsonb NOT NULL DEFAULT '{"mode":"open"}'::jsonb,
  -- Product codes granting access. Provider-agnostic on purpose (§3A.1).
  entitlement_product_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lms_courses_program ON public.lms_courses (program_slug);
CREATE INDEX IF NOT EXISTS idx_lms_courses_status ON public.lms_courses (status);
CREATE INDEX IF NOT EXISTS idx_lms_courses_translation_group ON public.lms_courses (translation_group_id);

-- ─────────────────────────────────────────
-- 3. Modules
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lms_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  "order" integer NOT NULL CHECK ("order" > 0),
  summary jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_lms_modules_course ON public.lms_modules (course_id, "order");

-- ─────────────────────────────────────────
-- 4. Lessons
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lms_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.lms_modules(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  "order" integer NOT NULL CHECK ("order" > 0),
  -- 1-based day for `daily` courses; NULL for open/sequential.
  day_index integer NULL CHECK (day_index IS NULL OR day_index > 0),
  duration_min integer NULL CHECK (duration_min IS NULL OR duration_min > 0),
  summary jsonb NULL,
  -- Typed block array; shape enforced by src/lms-core/blocks.ts, never free HTML.
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Lesson slug is the URL key, so it must be unique per course, not per module.
  UNIQUE (course_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_lms_lessons_course ON public.lms_lessons (course_id, "order");
CREATE INDEX IF NOT EXISTS idx_lms_lessons_module ON public.lms_lessons (module_id, "order");

-- ─────────────────────────────────────────
-- 5. Enrollments
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lms_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- How access was granted. NOT tied to any payment provider (§3A.1).
  source text NOT NULL DEFAULT 'order' CHECK (source IN ('order', 'token', 'manual')),
  order_ref text NULL,
  -- Drip anchor. Day 1 is the day of this timestamp in the learner's timezone.
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, auth_user_id)
);

CREATE INDEX IF NOT EXISTS idx_lms_enrollments_user ON public.lms_enrollments (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_lms_enrollments_course ON public.lms_enrollments (course_id);

-- ─────────────────────────────────────────
-- 6. Progress events (append-only)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lms_progress_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.lms_enrollments(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lms_lessons(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('lesson.started', 'lesson.completed', 'checklist.toggled')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Client-generated idempotency key: a retried offline flush is a no-op.
  client_id text NOT NULL,
  -- When it happened for the learner (may predate created_at after offline use).
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_lms_progress_events_enrollment
  ON public.lms_progress_events (enrollment_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_lms_progress_events_lesson
  ON public.lms_progress_events (lesson_id);

-- ─────────────────────────────────────────
-- 7. Reminder log (idempotency for the hourly cron)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lms_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.lms_enrollments(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lms_lessons(id) ON DELETE CASCADE,
  day_number integer NOT NULL,
  channel text NOT NULL DEFAULT 'telegram',
  sent_at timestamptz NOT NULL DEFAULT now(),
  -- One reminder per learner per course-day, whatever the cron cadence.
  UNIQUE (enrollment_id, day_number, channel)
);

-- ─────────────────────────────────────────
-- 8. updated_at triggers
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.lms_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['lms_courses', 'lms_modules', 'lms_lessons', 'lms_enrollments']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_' || target || '_updated_at') THEN
      EXECUTE format(
        'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.lms_set_updated_at()',
        target, target
      );
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────
-- 9. RLS
-- ─────────────────────────────────────────
-- Reads and writes go through the service-role API (/api/lms/*), which applies
-- entitlement rules from src/lms-core/access.ts. RLS is the backstop: published
-- content is readable by signed-in users, progress is private to its owner.
ALTER TABLE public.lms_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_progress_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_reminder_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lms_courses' AND policyname = 'Published courses are readable') THEN
    EXECUTE $p$ CREATE POLICY "Published courses are readable" ON public.lms_courses FOR SELECT TO authenticated USING (status = 'published') $p$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lms_courses' AND policyname = 'Admins can manage courses') THEN
    EXECUTE $p$ CREATE POLICY "Admins can manage courses" ON public.lms_courses FOR ALL USING (public.get_my_role() = 'admin') $p$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lms_modules' AND policyname = 'Modules of published courses are readable') THEN
    EXECUTE $p$ CREATE POLICY "Modules of published courses are readable" ON public.lms_modules FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.lms_courses c WHERE c.id = course_id AND c.status = 'published')) $p$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lms_modules' AND policyname = 'Admins can manage modules') THEN
    EXECUTE $p$ CREATE POLICY "Admins can manage modules" ON public.lms_modules FOR ALL USING (public.get_my_role() = 'admin') $p$;
  END IF;
END $$;

-- Lesson BODIES stay service-role only: entitlement is decided in lms-core, not
-- in SQL, so a signed-in user must not be able to read a paid lesson directly.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lms_lessons' AND policyname = 'Admins can manage lessons') THEN
    EXECUTE $p$ CREATE POLICY "Admins can manage lessons" ON public.lms_lessons FOR ALL USING (public.get_my_role() = 'admin') $p$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lms_enrollments' AND policyname = 'Users can view own enrollments') THEN
    EXECUTE $p$ CREATE POLICY "Users can view own enrollments" ON public.lms_enrollments FOR SELECT TO authenticated USING (auth_user_id = auth.uid()) $p$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lms_enrollments' AND policyname = 'Admins can manage enrollments') THEN
    EXECUTE $p$ CREATE POLICY "Admins can manage enrollments" ON public.lms_enrollments FOR ALL USING (public.get_my_role() in ('admin', 'support')) $p$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lms_progress_events' AND policyname = 'Users can view own progress') THEN
    EXECUTE $p$ CREATE POLICY "Users can view own progress" ON public.lms_progress_events FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.lms_enrollments e WHERE e.id = enrollment_id AND e.auth_user_id = auth.uid())) $p$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lms_progress_events' AND policyname = 'Admins can view progress') THEN
    EXECUTE $p$ CREATE POLICY "Admins can view progress" ON public.lms_progress_events FOR SELECT USING (public.get_my_role() in ('admin', 'support')) $p$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lms_reminder_log' AND policyname = 'Admins can view reminder log') THEN
    EXECUTE $p$ CREATE POLICY "Admins can view reminder log" ON public.lms_reminder_log FOR SELECT USING (public.get_my_role() in ('admin', 'support')) $p$;
  END IF;
END $$;
