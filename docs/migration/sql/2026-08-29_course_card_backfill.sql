-- CenterWay: every course says its own card, and one course is renamed.
-- APPLIED 2026-08-29 to production, in one transaction, over the session pooler.
-- Contract: src/lms-core/course.ts, src/lms-core/readiness.ts
-- Schema:   docs/migration/sql/2026-08-28_lms_course_card.sql (the columns)
--
-- WHY THIS EXISTS. The columns landed empty. Until they are filled, every card
-- still runs on the derivations the schema migration was written to retire —
-- the kind guessed from a lesson count, the subtitle cut out of the title by a
-- dash. This is the other half: the values, taken from what each course already
-- says about itself rather than invented here.
--
-- WHERE EACH VALUE COMES FROM. Nothing below is a new claim about a product:
--   · kind      — the lesson count and the course's own framing (a seven-day
--                 body course is a mini; a 16- and a 24-lesson programme is not)
--   · category  — the section the offer already ran under in content.ts, plus
--                 the second one where the course's OWN summary names it
--                 (way21 leads with «харчування» as well as «очищення»)
--   · days      — way21 is 21 by name and by content.ts; natural-body's 21 was
--                 confirmed by the owner against its 24 lessons
--   · posttitle — the exact text already sitting after the spaced dash in the
--                 title, said outright instead of being parsed back out
--
-- The seeds under data/courses/*.json carry the same values; this file and they
-- must not disagree.

BEGIN;

-- ─────────────────────────────────────────
-- 1. The course is renamed; the PROGRAM is not
-- ─────────────────────────────────────────
-- `program_slug` keeps pointing at `ideal-body`, and so does everything keyed on
-- it: /programs/ideal-body, LEAD_PRODUCT_CODES, the entitlement code on the
-- seed. Course and program are already two vocabularies here — `short` has run
-- under program `reboot` all along — so this is the existing split, used.
--
-- Safe because no row anywhere references a course by slug: lms_lessons,
-- lms_modules, lms_enrollments, lms_course_offers, lms_course_revisions and the
-- rest all carry course_id. Checked before running; the two enrolments on this
-- course keep their access. What breaks is a bookmarked /learn/ideal-body.
UPDATE public.lms_courses
   SET slug = 'natural-body', translation_group_id = 'natural-body'
 WHERE slug = 'ideal-body';

-- ─────────────────────────────────────────
-- 2. The card fields
-- ─────────────────────────────────────────
UPDATE public.lms_courses SET kind='course', categories='["nutrition"]'::jsonb, duration_days=21
 WHERE slug='natural-body';

UPDATE public.lms_courses SET kind='mini', categories='["nutrition","cleansing"]'::jsonb,
       posttitle='практикум з умовного голодування'
 WHERE slug='reset-day';

UPDATE public.lms_courses SET kind='mini', categories='["movement"]'::jsonb
 WHERE slug='short';

UPDATE public.lms_courses SET kind='course', categories='["cleansing","nutrition"]'::jsonb,
       duration_days=21, posttitle='інтегративна детокс-програма'
 WHERE slug='way21';

-- NO DURATION, deliberately. Its own summary says «7 щоденних уроків» while the
-- row carries ten lessons, and the 12-week figure in content.ts belongs to the
-- IREM marketing programme, not to this draft. The course is hidden, so the
-- showcase gate does not ask; when it goes public the author answers, and a
-- wrong number would be worse than none.
UPDATE public.lms_courses SET kind='course', categories='["movement"]'::jsonb
 WHERE slug='ivem-gimnastika';

COMMIT;

-- STILL OWED, and only when these two go public: way21 and ivem-gimnastika have
-- no tagline, which is a showcase blocker the moment visibility leaves 'hidden'.
-- Visibility was deliberately not touched here — which courses are on the shelf
-- is the owner's call, not a backfill's.
