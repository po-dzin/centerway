-- CenterWay: one offer per course, said by the schema instead of by habit.
-- Run in Supabase SQL editor (public schema).
-- Contract: src/lib/lms/server.ts (readAccessRule) + src/lib/admin/catalog.ts
--
-- APPLIED 2026-08-28 through the session pooler and recorded in
-- supabase_migrations.schema_migrations as version 20260828010000. NOT the
-- stamp `npm run db:stage` would produce: the staging script derives the
-- version from the DATE alone, and 20260828000000 was already taken by
-- lms_reader_annotations. Staging this file would collide with that record and
-- `db push` would treat the migration as already applied and skip it silently.
-- Pre-flight on live data before applying: 2 offer rows on 2 distinct courses,
-- no duplicates, no pre-existing UNIQUE (course_id).
--
-- WHAT THIS CLOSES. `lms_course_offers` has `code text NOT NULL UNIQUE` and a
-- non-unique index on `course_id`. "One offer per course" was therefore never a
-- rule — it was the observation that nobody had inserted a second row. Three
-- pieces of working code already depend on it being a rule:
--
--  1. src/lib/lms/server.ts — readAccessRule() reads the term of access with
--     `.eq("course_id", …).maybeSingle()`. PostgREST answers a second matching
--     row with an ERROR, not with a row; the caller discards the error and
--     reads `data` as null. A null rule means "no term configured", and
--     planAccess reads no term as PERPETUAL. So the failure is silent AND it
--     falls towards giving access away, which is the wrong direction for a
--     mistake to fall.
--
--  2. The comment above that same function justifies not filtering on `active`
--     with "code is unique per course, so there is exactly one, never a history
--     of them". `code` is unique GLOBALLY; that says nothing about a course.
--     The conclusion was right and the reason was not — this constraint is the
--     reason.
--
--  3. src/lib/admin/catalog.ts — listCatalog() folds the offers into
--     `new Map(rows.map(row => [row.course_id, …]))`. With two rows the last
--     one wins, arbitrarily, and the admin catalogue quotes a price that is not
--     the one being charged.
--
-- WHAT THIS DOES NOT DECIDE. Whether a course may ever carry several offers
-- (a supported package sold beside the bare course) is still open — see
-- docs/archive/working-notes/2026-08-28_phase-1-open-questions.md Q4. The
-- recommendation there is that breadth arrives by composition, so the second
-- offer becomes a second Experience over the same course rather than a second
-- row here. If that answer goes the other way, this constraint is dropped in
-- the same migration that moves the term of access from the offer onto
-- `orders` — which is the work the second row actually requires, and the
-- reason it must not be reachable by accident before then.

-- ─────────────────────────────────────────
-- 1. Refuse to proceed on data that already violates it
-- ─────────────────────────────────────────
-- ADD CONSTRAINT would fail on its own here, but with Postgres's own message,
-- which names one duplicate key and not the courses involved. This names them,
-- because whoever runs into it has to decide which row is the real offer before
-- anything else can happen.
DO $$
DECLARE
  offenders text;
BEGIN
  SELECT string_agg(format('%s (%s offers)', c.slug, d.n), ', ' ORDER BY c.slug)
    INTO offenders
  FROM (
    SELECT course_id, count(*) AS n
    FROM public.lms_course_offers
    GROUP BY course_id
    HAVING count(*) > 1
  ) d
  JOIN public.lms_courses c ON c.id = d.course_id;

  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION
      'lms_course_offers: % already carries more than one offer. Decide which row is the offer (and withdraw or delete the rest) before adding the constraint.',
      offenders;
  END IF;
END $$;

-- ─────────────────────────────────────────
-- 2. The constraint
-- ─────────────────────────────────────────
ALTER TABLE public.lms_course_offers
  DROP CONSTRAINT IF EXISTS lms_course_offers_one_per_course;

ALTER TABLE public.lms_course_offers
  ADD CONSTRAINT lms_course_offers_one_per_course UNIQUE (course_id);

-- `code` stays globally unique and keeps its own meaning: it is the string that
-- travels through orders/payments/access_tokens/events, so two courses must
-- never share one. This constraint is about the other direction.
--
-- NOTE on idx_lms_course_offers_course (partial, WHERE active): the unique
-- constraint creates its own index on `course_id`, so the partial one is now
-- redundant for lookups. Left in place deliberately — dropping an index is a
-- separate decision from adding a rule, and it costs nothing to keep until Q4
-- is answered.
