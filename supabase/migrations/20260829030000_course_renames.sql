-- CenterWay: two courses take the names their product already uses.
-- APPLIED 2026-08-29 to production, in one transaction, over the session pooler.
-- Repo side: data/courses/*.json, src/lib/platform/content.ts, src/lib/products.ts,
--            src/app/(platform)/programs/{natural-body,ideal-body}/page.tsx
--
-- `reboot` was deliberately left alone. It is not only a programme slug — it is
-- a live host, a funnel route, an A/B variant and a static-landing brand — and
-- renaming it would move traffic, not just an identifier.
--
-- ENTITLEMENT CODES GAIN A NAME, THEY NEVER LOSE ONE. A grant was written with
-- whatever code the product had that day, so the old one stays in the array
-- beside the new one — the same shape `short` already carries (`{short,reboot}`)
-- and `reset-day` (`{reset-day,mini-detox}`). Dropping the old code would revoke
-- access from everyone who bought under the old name.

BEGIN;

-- ─────────────────────────────────────────
-- 1. ivem-gimnastika → irem-gymnastics
-- ─────────────────────────────────────────
-- SEVEN DAYS, said by the course itself: its second module is titled
-- «7 днів практики» and holds Monday through Sunday. The 12-week figure that
-- used to sit on the IREM offer card was a span nothing in the material ran
-- for; it is gone from content.ts in the same change.
UPDATE public.lms_courses
   SET slug = 'irem-gymnastics',
       program_slug = 'irem-gymnastics',
       translation_group_id = 'irem-gymnastics',
       entitlement_product_codes = ARRAY['irem-gymnastics', 'ivem-gimnastika'],
       duration_days = 7
 WHERE slug = 'ivem-gimnastika';

-- ─────────────────────────────────────────
-- 2. natural-body finishes its rename
-- ─────────────────────────────────────────
-- The course slug moved yesterday; the PROGRAMME and the lead product code
-- follow now. /programs/ideal-body stays as a permanent redirect, and
-- `normalizePayableProduct` still answers to `ideal-body`, `ideal_body` and
-- `idealne-tilo` — every way the old name can arrive from outside.
UPDATE public.lms_courses
   SET program_slug = 'natural-body',
       entitlement_product_codes = ARRAY['natural-body', 'ideal-body']
 WHERE slug = 'natural-body';

COMMIT;
