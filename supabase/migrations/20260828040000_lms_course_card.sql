-- CenterWay: the catalogue card stops being guessed.
-- APPLIED 2026-08-29 to production, in one transaction, over the session
-- pooler. Verified after: the five columns exist, both CHECK constraints are
-- in place, `duration` is gone, and the two rows that carried prose came
-- across whole — reset-day 3, short 7. Nothing was left behind: every
-- non-null `duration` in the table was a leading integer.
-- Run in Supabase SQL editor (public schema).
-- Contract: src/lms-core/course.ts (card fields), src/lms-core/readiness.ts
-- Notes:    docs/builder-showcase-split-2026-08-28.md
--
-- WHAT THIS CLOSES. Three things a card printed were DERIVED from the material
-- rather than said by the author:
--
--   · the kind badge — `lessons <= 8 ? 'Міні-курс' : 'Програма'`, which calls a
--     twelve-item checklist a programme and a six-lesson course a mini one;
--   · the subtitle — cut out of the title by matching a spaced dash, which
--     works until a title legitimately contains one;
--   · the section — nothing derived it, because nothing could. A shelf that
--     cannot be filtered is a shelf that grows until nobody scrolls it.
--
-- Same split as 2026-08-22 and 2026-08-26: every column here is a CLAIM ABOUT
-- THE MATERIAL, which the author owns. No column touches price, and
-- lms_course_offers is not modified.

-- ─────────────────────────────────────────
-- 1. The three lines around the title
-- ─────────────────────────────────────────
-- The small line ABOVE the name — «Авторський курс», «Спільно з IREM».
-- Deliberately not the kind and not the section: those two are a badge drawn
-- from closed lists, in the same words on every card. This is the author's own.
ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS pretitle text NULL;

-- The line BELOW the name — what kind of thing this is, in a sentence fragment:
-- «практикум з умовного голодування». Authors were already writing it, into the
-- title after a dash, and `offerSubtitle` cut it back out by pattern. The
-- pattern stays as the fallback for rows written before this column.
ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS posttitle text NULL;

-- Lengths are NOT constrained here, and that is on purpose: the ceilings live in
-- `validateCourse` (COURSE_PRETITLE_MAX / COURSE_POSTTITLE_MAX), one validator
-- every writer already passes through. A CHECK here would be a second opinion
-- that can disagree with it after one edit to the TypeScript.

-- ─────────────────────────────────────────
-- 2. The badge
-- ─────────────────────────────────────────
-- What kind of thing this is. Closed list, checked in the database as well as in
-- lms-core — unlike the lengths above, this one is a small fixed vocabulary that
-- a filter and an index will read, and a typo'd value here is a row that no
-- query finds rather than a line that looks slightly long.
ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS kind text NULL;

ALTER TABLE public.lms_courses
  DROP CONSTRAINT IF EXISTS lms_courses_kind_check;

ALTER TABLE public.lms_courses
  ADD CONSTRAINT lms_courses_kind_check
  CHECK (kind IS NULL OR kind IN ('course', 'mini', 'checklist'));

-- What it is about. jsonb array of codes from the closed list, for the same
-- reason `results` and `audience` are jsonb: the shape is validated in lms-core,
-- and one validator beats a column constraint that can disagree with it.
--
-- An ARRAY rather than one value: a course is legitimately about харчування and
-- очищення at once, and forcing one would make the author pick the less wrong
-- of two true answers.
ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS categories jsonb NULL;

-- How many DAYS the course takes. This REPLACES `duration text` («3 дні»).
--
-- Why the change. Two surfaces need the same fact in different words — a badge
-- writes «3 дні», a filter compares it to 7 — and a string can only serve the
-- first. The grammar («день / дні / днів») belongs to the renderer and its
-- locale, not to a value typed once by an author who cannot change the UI that
-- prints it.
ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS duration_days integer NULL;

ALTER TABLE public.lms_courses
  DROP CONSTRAINT IF EXISTS lms_courses_duration_days_check;

-- The ceiling exists because a typo in a number field is silent: «210» is a
-- plausible-looking value and an impossible product, and the badge would print
-- it without blinking. 366 is a year with a leap day in it.
ALTER TABLE public.lms_courses
  ADD CONSTRAINT lms_courses_duration_days_check
  CHECK (duration_days IS NULL OR (duration_days >= 1 AND duration_days <= 366));

-- ─────────────────────────────────────────
-- 3. Carry the prose across, then drop it
-- ─────────────────────────────────────────
-- Two rows carry a value today — «7 днів» and «3 дні» — and both are a leading
-- integer. Anything that is NOT a leading integer is left behind rather than
-- guessed at: `substring` returns NULL, the course reads back as "no duration
-- stated", and the catalogue falls back to counting lessons exactly as it did
-- before the prose column existed. A wrong number would be worse than none.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lms_courses' AND column_name = 'duration'
  ) THEN
    UPDATE public.lms_courses
      SET duration_days = LEAST(366, GREATEST(1, (substring(duration from '^\s*(\d+)'))::integer))
      WHERE duration_days IS NULL
        AND substring(duration from '^\s*(\d+)') IS NOT NULL;

    -- DROPPED, not kept alongside. Keeping it would leave two answers to "how
    -- long is this" in one row, and the day somebody edits the number without
    -- the prose, one of them is a lie — which is the exact failure the offer
    -- surface already hit once (see 2026-08-26_reset_day_restore_offer_surface).
    ALTER TABLE public.lms_courses DROP COLUMN duration;
  END IF;
END $$;
