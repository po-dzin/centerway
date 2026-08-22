-- CenterWay: what the builder needs to be a real editor (H2, wave 2)
-- Run in Supabase SQL editor (public schema).
-- Contract: src/lms-core/course.ts + src/lms-core/theme.ts
-- Mapping:  src/lib/lms/authoring.ts (courseRows / courseFromRows)
--
-- Four columns, each closing a hole the first builder pass had to work around.

-- ─────────────────────────────────────────
-- 1. Per-course look
-- ─────────────────────────────────────────
-- A CHOICE, not values: {palette, headingFont, scale}, each from a closed list
-- validated in src/lms-core/theme.ts. Free hex would be a colour no contrast
-- gate ever measured; a pack name is one that was measured once.
ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS theme jsonb NULL;

-- ─────────────────────────────────────────
-- 2. Card image
-- ─────────────────────────────────────────
-- {src, alt}. `alt` is required by the validator, not by the column: a NOT NULL
-- inside jsonb is not a thing Postgres checks, and duplicating the rule as a
-- CHECK would put the same decision in two places that can disagree.
ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS cover jsonb NULL;

-- ─────────────────────────────────────────
-- 3. Author's own order
-- ─────────────────────────────────────────
-- The shelf is ordered by what the author is working on, which is neither
-- alphabetical nor chronological. NULL sorts last — an existing course has no
-- opinion until someone drags it, and inventing one would reshuffle every
-- author's list the moment this migration ran.
ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS sort_order integer NULL;

CREATE INDEX IF NOT EXISTS idx_lms_courses_sort ON public.lms_courses (author_id, sort_order);

-- ─────────────────────────────────────────
-- 4. Reference modules become a column
-- ─────────────────────────────────────────
-- `reference` was a JSON-only flag with no column, so the builder could not
-- recover it from the database: it read the flag out of the shipped file
-- (`referenceModuleSlugs` in src/lib/lms/builder.ts) and a module authored in
-- the builder could never be one at all. That stopgap is deleted with this
-- column; a reference module is excluded from the numbered flow and from
-- completion (src/lms-core/course.ts).
ALTER TABLE public.lms_modules
  ADD COLUMN IF NOT EXISTS reference boolean NOT NULL DEFAULT false;

-- Backfill from the two shipped courses, by slug. Both are house-owned and both
-- carry exactly one reference module; running this twice is a no-op.
UPDATE public.lms_modules m
   SET reference = true
  FROM public.lms_courses c
 WHERE m.course_id = c.id
   AND c.slug IN ('way21', 'reset-day')
   AND m.slug = 'materials'
   AND m.reference = false;
