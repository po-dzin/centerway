-- CenterWay: access becomes a WINDOW with an owner, a source and an end.
-- Run in Supabase SQL editor (public schema).
-- Contract: src/lms-core/access.ts + src/lib/lms/server.ts + src/lib/admin/access.ts
--
-- WHAT THIS CLOSES. Three holes, all of them the same shape — a promise the
-- database could not keep:
--
--  1. `lms_enrollments.expires_at` existed and only an admin could ever write
--     it. A purchase therefore granted PERPETUAL access to everything, whatever
--     the offer page said next to the price. The term of access was prose
--     (`lms_courses.access_note`) and nothing enforced it.
--
--  2. Revoking access DELETED the enrollment row. But entitlement is derived
--     from paid `orders`, which stay — so the next visit re-created the row and
--     the revoke undid itself, having destroyed the learner's progress on the
--     way out. There was no way to say "closed" that a purchase could not
--     silently re-open.
--
--  3. Nothing recorded WHO granted access by hand, and `source` could not tell
--     a bonus seat from a promo one.
--
-- WHERE THE TERM LIVES, AND WHY IT IS NOT ON THE COURSE. `lms_course_offers` is
-- the owner's table (2026-08-22): the author owns what the course claims, the
-- owner owns what it costs. How long access lasts is bought and sold — it is
-- half of the price, not a claim about the material — so it belongs beside
-- `amount`, under the same admin-only policy. Putting it on `lms_courses` would
-- have handed an external author the commercial term along with their copy.
--
-- `lms_courses.access_note` STAYS and is not made redundant. It is the sentence
-- printed on the offer page; `access_days` is the number the gate enforces. The
-- 2026-08-26 offer-surface migration argued they must be free to differ, and
-- that is still true — the note may read «доступ на місяць» while support
-- extends one refunded learner by a week.

-- ─────────────────────────────────────────
-- 1. The term of access, beside the price
-- ─────────────────────────────────────────
-- How many days of access one purchase buys. NULL means "does not end", and is
-- only legal together with `access_lifetime`.
ALTER TABLE public.lms_course_offers
  ADD COLUMN IF NOT EXISTS access_days integer NULL;

-- The EXPLICIT "forever". Without it, NULL would carry two meanings — "sold as
-- perpetual" and "nobody said" — and the offer that was never configured would
-- be indistinguishable from the one deliberately sold without an end. The
-- CHECK below is what makes the term a required decision rather than a default.
ALTER TABLE public.lms_course_offers
  ADD COLUMN IF NOT EXISTS access_lifetime boolean NOT NULL DEFAULT false;

-- Existing rows were all sold as perpetual — that is literally what the code
-- did before this migration. Backfilling them as lifetime keeps every buyer
-- exactly where they are; the alternative (a term applied retroactively) would
-- close doors people already paid for.
UPDATE public.lms_course_offers
   SET access_lifetime = true
 WHERE access_days IS NULL
   AND access_lifetime = false;

ALTER TABLE public.lms_course_offers DROP CONSTRAINT IF EXISTS lms_course_offers_access_rule_check;
ALTER TABLE public.lms_course_offers ADD CONSTRAINT lms_course_offers_access_rule_check
  CHECK (
    (access_lifetime AND access_days IS NULL)
    OR (NOT access_lifetime AND access_days IS NOT NULL AND access_days > 0)
  );

COMMENT ON COLUMN public.lms_course_offers.access_days IS
  'Days of access one purchase buys, counted from the payment. NULL only with access_lifetime.';
COMMENT ON COLUMN public.lms_course_offers.access_lifetime IS
  'Sold without an end. Explicit so that "nobody configured a term" is not spelled the same way.';

-- ─────────────────────────────────────────
-- 2. Access has a state of its own
-- ─────────────────────────────────────────
-- `active` | `revoked`. Expiry is NOT a status: it is derived from expires_at
-- at read time, so a lapsed deadline closes access the second it passes,
-- without a cron having to have run (§15 of the access brief). Storing it
-- would create a second truth that can disagree with the date beside it.
ALTER TABLE public.lms_enrollments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE public.lms_enrollments DROP CONSTRAINT IF EXISTS lms_enrollments_status_check;
ALTER TABLE public.lms_enrollments ADD CONSTRAINT lms_enrollments_status_check
  CHECK (status IN ('active', 'revoked'));

ALTER TABLE public.lms_enrollments
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz NULL;

-- THE BAN, kept apart from the revoke on purpose.
--
-- A revoke is commercial and reversible by commerce: it closes the seat bought
-- by ONE purchase, and a fresh purchase opens a new window. A ban is about the
-- person, and no payment may lift it — otherwise the way back in costs money
-- and is always available. Two states, two fields, because they answer to
-- different things; folding the ban into `status` would have made "did they pay
-- again?" the question that decides both.
ALTER TABLE public.lms_enrollments
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz NULL;

ALTER TABLE public.lms_enrollments
  ADD COLUMN IF NOT EXISTS blocked_reason text NULL;

-- Who granted this by hand. NULL for everything a purchase created, which is
-- most rows — the order_ref already answers "why" for those.
ALTER TABLE public.lms_enrollments
  ADD COLUMN IF NOT EXISTS granted_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.lms_enrollments.status IS
  'active | revoked. Expiry is derived from expires_at, never stored here.';
COMMENT ON COLUMN public.lms_enrollments.blocked_at IS
  'A ban on the person for this course. Unlike a revoke, no new purchase lifts it.';

-- ─────────────────────────────────────────
-- 3. Where access came from
-- ─────────────────────────────────────────
-- `order` and `token` are the two shapes a PURCHASE takes here (a paid order,
-- and a paid order handed over by an access token) and are not merged into one
-- "purchase" value: the distinction is already written into thousands of rows
-- and into lms-core's entitlement. `manual` stays what an admin grant is
-- called. `bonus` and `promotion` are new and exist so that an operator can
-- answer "why does this person have this?" a year later without a note in a
-- Telegram thread.
ALTER TABLE public.lms_enrollments DROP CONSTRAINT IF EXISTS lms_enrollments_source_check;
ALTER TABLE public.lms_enrollments ADD CONSTRAINT lms_enrollments_source_check
  CHECK (source IN ('order', 'token', 'manual', 'bonus', 'promotion'));

-- ─────────────────────────────────────────
-- 4. Reading one person's access, fast
-- ─────────────────────────────────────────
-- The cabinet asks "everything this account holds" on every visit, and the
-- admin panel asks "everyone on this course". The first index existed; this one
-- keeps the deadline sweep and the per-account read off a sequential scan once
-- expires_at is populated for real.
CREATE INDEX IF NOT EXISTS idx_lms_enrollments_user_status
  ON public.lms_enrollments (auth_user_id, status);

CREATE INDEX IF NOT EXISTS idx_lms_enrollments_expiry
  ON public.lms_enrollments (expires_at)
  WHERE expires_at IS NOT NULL;
