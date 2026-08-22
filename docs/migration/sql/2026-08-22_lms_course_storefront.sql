-- CenterWay: a course built in the builder becomes something that can be found
-- and bought (H2, wave 3 — the P0 of docs/showcase-lms-builder-research-2026-08-22.md).
-- Run in Supabase SQL editor (public schema).
-- Contract: src/lms-core/course.ts (storefront fields) + src/lib/platform/offers.ts
--
-- THE SPLIT THIS ENCODES. Two owners, and they are not the same person:
--
--   the AUTHOR owns what the course IS — title, summary, tagline, promises,
--   and whether it is finished enough to be listed. All of that is content,
--   and it lives on lms_courses beside the content it describes.
--
--   the OWNER owns what the course COSTS. Price is not a claim about the
--   material, it is a commitment the business makes to a buyer, and an
--   external author who could set it could set their own payout. It lives in
--   a separate table for exactly that reason: a different table is a
--   different grant, and the builder's authoring routes never touch it.
--
-- Merging them into one row would have made "who may write this column"
-- a policy detail instead of a structural fact.

-- ─────────────────────────────────────────
-- 1. What the card and the offer page say
-- ─────────────────────────────────────────
-- The one line under the title on a card. NOT the summary: `summary` answers
-- "what is this", tagline answers "why would I". The six hand-written programs
-- carry both today (content.ts: `tag` and `description`), and a course out of
-- the builder had neither.
ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS tagline text NULL;

-- What the buyer walks away with, as an array of short strings. jsonb rather
-- than text[]: the shape is validated in lms-core, where every other authored
-- structure is, and one validator is better than a column constraint and a
-- validator that can disagree.
ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS results jsonb NULL;

-- ─────────────────────────────────────────
-- 2. Whether the world may see it
-- ─────────────────────────────────────────
-- THREE STATES, AND `status` IS NOT ONE OF THEM. `status` says whether the
-- material is published to the people who already bought it; visibility says
-- whether strangers may find it. They are genuinely independent: a live course
-- sold only through a landing is published and unlisted, and a finished course
-- awaiting a price is published and hidden.
--
--   hidden   — reachable only by direct link to /learn for people who own it
--   unlisted — has an offer page, is not in the catalogue or the sitemap
--   listed   — in the catalogue
--
-- Default `hidden`: a migration must not put anything on sale. Every existing
-- row becomes hidden, and the two shipped courses keep selling through their
-- hand-written pages, which do not read this column at all.
ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'hidden';

ALTER TABLE public.lms_courses
  DROP CONSTRAINT IF EXISTS lms_courses_visibility_check;

ALTER TABLE public.lms_courses
  ADD CONSTRAINT lms_courses_visibility_check
  CHECK (visibility IN ('hidden', 'unlisted', 'listed'));

-- The catalogue reads "listed courses, in the author's order". Partial, because
-- hidden is the overwhelming majority and will stay so.
CREATE INDEX IF NOT EXISTS idx_lms_courses_listed
  ON public.lms_courses (sort_order)
  WHERE visibility = 'listed';

-- ─────────────────────────────────────────
-- 3. The price, in its own table
-- ─────────────────────────────────────────
-- One row per sellable offer. A course may have none (not for sale), one
-- (the usual), or several later — a guided package beside the plain course is
-- already how way21 is sold, and that is two prices for one body of material.
--
-- `code` is the payable product code, the same namespace src/lib/products.ts
-- uses, because the payment route resolves ONE key and must not have to guess
-- which of two tables it came from. Built as `course:<slug>` for the courses
-- that come from here, so a hand-written code and a database code can never
-- collide.
CREATE TABLE IF NOT EXISTS public.lms_course_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.lms_courses (id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  -- What is charged, in the currency's minor-unit-free form this repo already
  -- uses everywhere (UAH, whole hryvnia — see src/lib/products.ts).
  amount integer NOT NULL CHECK (amount > 0),
  -- What is QUOTED when it differs from what is charged: the struck-through
  -- number. NULL means "quote the amount", not "quote nothing".
  list_amount integer NULL CHECK (list_amount IS NULL OR list_amount > 0),
  currency text NOT NULL DEFAULT 'UAH',
  -- Kept verbatim once set: it is a reporting label in Meta, and renaming it
  -- splits one product's history into two lines.
  pixel_content_name text NOT NULL,
  -- An offer can be withdrawn without deleting the record of what was sold.
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lms_course_offers_course
  ON public.lms_course_offers (course_id)
  WHERE active;

-- ─────────────────────────────────────────
-- 4. Who may read and write it
-- ─────────────────────────────────────────
ALTER TABLE public.lms_course_offers ENABLE ROW LEVEL SECURITY;

-- Nobody at all, through the anon or authenticated keys. Reading a price is
-- done by the server with the service role while rendering an offer page, and
-- writing one is an owner action through the admin surface. An author holds
-- neither key, so "the author cannot set their own price" is enforced by the
-- absence of a policy rather than by a rule that could be relaxed by accident.
DROP POLICY IF EXISTS lms_course_offers_admin_all ON public.lms_course_offers;

CREATE POLICY lms_course_offers_admin_all ON public.lms_course_offers
  FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');
