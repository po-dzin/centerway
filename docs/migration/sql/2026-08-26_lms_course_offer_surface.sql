-- CenterWay: the offer page stops being written in TypeScript.
-- Run in Supabase SQL editor (public schema).
-- Contract: src/lms-core/course.ts (offer-surface fields) + src/lms-core/author.ts
--
-- WHAT THIS CLOSES. Six programs have hand-written pages under
-- src/app/(platform)/programs/, and everything those pages say that a course
-- could not — who it is for, what medium it is in, how long it takes, how long
-- access lasts, who made it — lived in src/lib/platform/content.ts as literals.
-- A course out of the builder had no way to say any of it, so a builder-driven
-- offer page was structurally thinner than a hand-written one and always would
-- have been.
--
-- The split from 20260822000000 is preserved exactly: everything added to
-- lms_courses here is a CLAIM ABOUT THE MATERIAL, which the author owns. No
-- column here touches price, and lms_course_offers is not modified.

-- ─────────────────────────────────────────
-- 1. What the offer page says about the course
-- ─────────────────────────────────────────
-- Who it is for. The other half of `results`: one says what changes, this says
-- who it changes for. jsonb for the same reason `results` is jsonb — the shape
-- is validated in lms-core, and one validator beats a column constraint that
-- can disagree with it.
ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS audience jsonb NULL;

-- What the course is MADE OF — video, audio, checklists, recipes. Not the
-- module outline: a buyer scanning an offer wants the medium before the
-- structure.
ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS format jsonb NULL;

-- How long it takes, in the author's own words.
--
-- The offer page derives a duration from the lesson count today, which is true
-- and useless: reset-day is twelve lessons meant to be walked over three days,
-- and it currently advertises "1 день" on the platform while its own landing
-- says "3 дні". No count can resolve that; only the author can. NULL keeps the
-- derived count, which is the behaviour every existing row already has.
ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS duration text NULL;

-- How long access lasts, as PROSE printed next to the price.
--
-- Deliberately not a number of days. The enforcing value is
-- lms_enrollments.expires_at, written per grant, and the two must be free to
-- differ: an owner sells "доступ назавжди" and still revokes a refunded seat.
-- A course-level integer would have made the promise and the enforcement the
-- same field, and then one of them would have been wrong.
ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS access_note text NULL;

-- Why THIS author for THIS course — one sentence. The concentrate; the reusable
-- biography lives in lms_authors below.
ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS author_note text NULL;

-- ─────────────────────────────────────────
-- 2. The author, once
-- ─────────────────────────────────────────
-- WHY A TABLE AND NOT FIVE MORE COLUMNS. The biography, the credentials and the
-- portrait do not change between one author's courses; the sentence about why
-- they wrote THIS one does. Denormalising the profile onto every course would
-- mean editing a bio in as many places as the author has published, and would
-- make "all courses by this person" a string comparison over names.
--
-- This is also the row a profile page reads: one author, their courses, their
-- programs. That page cannot exist while the biography is a literal inside a
-- marketing landing, which is where it lives today.
CREATE TABLE IF NOT EXISTS public.lms_authors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The account, when the author has one. NULL is a normal state, not a broken
  -- one: a profile can exist for someone who has never signed in, and the six
  -- shipped programs are admin-managed.
  auth_user_id uuid NULL UNIQUE REFERENCES auth.users (id) ON DELETE SET NULL,
  -- The profile page's address. Stable and human-written, never derived from
  -- the name: people change how their name is spelled, and a URL that follows
  -- would break every link to them.
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  -- What they are to the platform — "Засновник центру CenterWay". One line.
  role text NULL,
  bio text NULL,
  -- The author in their own voice. Rendered as a quotation, so it is stored
  -- apart from the bio rather than being a paragraph inside it.
  quote text NULL,
  -- Short verifiable statements: degrees, years, titles. jsonb array of strings.
  credentials jsonb NULL,
  -- {src, alt} — same shape and the same mandatory alt as lms_courses.cover.
  photo jsonb NULL,
  -- Whether the profile page is reachable by strangers. Default false for the
  -- same reason visibility defaults to 'hidden': a migration must not publish
  -- anybody.
  listed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The link from a course to its author's profile.
--
-- SEPARATE FROM lms_courses.author_id, which exists already and references
-- auth.users — that column answers "who may edit this row" and is the subject
-- of the authorship RLS policies from 20260820000000. This one answers "whose
-- name is printed on the offer page". They are usually the same person and are
-- not the same question: an admin-managed course has no author_id and still has
-- an author, and reusing the editing grant as a byline would have made
-- publishing someone's name a side effect of giving them write access.
ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS author_profile_id uuid NULL
  REFERENCES public.lms_authors (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lms_courses_author_profile
  ON public.lms_courses (author_profile_id)
  WHERE author_profile_id IS NOT NULL;

-- ─────────────────────────────────────────
-- 3. Who may read and write an author
-- ─────────────────────────────────────────
ALTER TABLE public.lms_authors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lms_authors_public_read ON public.lms_authors;
DROP POLICY IF EXISTS lms_authors_self_manage ON public.lms_authors;
DROP POLICY IF EXISTS lms_authors_admin_all ON public.lms_authors;

-- A listed profile is public by design — it is a page strangers are meant to
-- reach. Unlisted profiles stay invisible here; the server reads those with the
-- service role while rendering a course whose author has not published a page.
CREATE POLICY lms_authors_public_read ON public.lms_authors
  FOR SELECT
  TO anon, authenticated
  USING (listed);

-- An author edits their own profile and nobody else's. `listed` is deliberately
-- NOT protected from them: publishing your own biography is yours to decide,
-- unlike the price of your course.
CREATE POLICY lms_authors_self_manage ON public.lms_authors
  FOR ALL
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY lms_authors_admin_all ON public.lms_authors
  FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');
