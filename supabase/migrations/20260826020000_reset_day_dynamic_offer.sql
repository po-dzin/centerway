-- CenterWay: Reset Day leaves the hand-written path entirely — page AND price.
-- Run in Supabase SQL editor (public schema).
-- Contract: src/lib/platform/offers.ts + src/lms-core/offerCode.ts
--
-- WHAT THIS FINISHES. The page already reads its copy from the course
-- (2026-08-26_reset_day_offer_content.sql) but was still served by a
-- hand-written route and still priced from a constant in src/lib/products.ts.
-- After this it is served by /programs/[slug] like any course out of the
-- builder, and its price is a row an admin can change without a deploy.
--
-- THE PRICE STAYS WHERE IT IS, and that is deliberate. `amount` is what is
-- CHARGED and reset-day is currently inside the 1 ₴ QA window
-- (CW_TEST_PRICE_1UAH in src/lib/products.ts); `list_amount` is what the page
-- QUOTES. Copying both across keeps the behaviour identical to the hour before
-- this ran — moving the price into the database must not be the thing that
-- silently starts charging people 795 ₴. Ending the QA window is one command
-- and a separate decision:
--
--   npm run admin:offer -- --slug=reset-day --amount=795 --list-amount=795
--
-- `pixel_content_name` is 'Reset Day' VERBATIM, not the course title. It is a
-- reporting label in Meta, and the 2026-08-22 migration says why it is kept
-- once set: renaming it splits one product's history into two lines. The
-- `admin:offer` script would have defaulted it to the course's own title, which
-- is exactly that mistake — hence SQL here rather than the script.
--
-- `access_lifetime = true` IS STATED, not left to default. The 2026-08-26
-- program-access-windows migration added a CHECK requiring one of
-- access_days/access_lifetime to say something, and its own default
-- (access_lifetime false, access_days null) satisfies neither — an insert that
-- left this out would violate the CHECK on a fresh database applying both
-- files in filename order, and would abort before Reset Day was ever listed.
-- `true` is not a placeholder: the offer page has told buyers "доступ
-- назавжди" since the 2026-08-26 offer-content migration, and lifetime is the
-- only value that keeps that sentence true.

INSERT INTO public.lms_course_offers (course_id, code, amount, list_amount, currency, pixel_content_name, access_lifetime, active)
SELECT id, 'course:reset-day', 1, 795, 'UAH', 'Reset Day', true, true
FROM public.lms_courses
WHERE slug = 'reset-day'
ON CONFLICT (code) DO UPDATE SET
  amount = EXCLUDED.amount,
  list_amount = EXCLUDED.list_amount,
  currency = EXCLUDED.currency,
  pixel_content_name = EXCLUDED.pixel_content_name,
  access_lifetime = EXCLUDED.access_lifetime,
  active = true,
  updated_at = now();

-- Now it may be found. `listed` rather than `unlisted` because the course IS in
-- the catalogue — it has been for months, through a hard-coded entry in
-- content.ts that this change removes. Saying `unlisted` while the catalogue
-- still showed it would have made the column a description of nothing.
--
-- Safe to flip only together with that removal: with both the content.ts entry
-- and a listed course present, /programs renders the same product twice, once
-- from each source.
UPDATE public.lms_courses
SET visibility = 'listed', updated_at = now()
WHERE slug = 'reset-day';

-- ENTITLEMENT IS UNAFFECTED, and this is the part worth checking twice.
-- New purchases are filed under `course:reset-day`; every past one is under
-- `reset-day` or the older `mini-detox`. Nobody loses access, because:
--   · the course already declares both legacy codes in
--     entitlement_product_codes, and
--   · resolveEntitlement (src/lms-core/access.ts) always accepts a course's own
--     offer code, listed or not.
-- So the three codes all open the same course, which is what lets the funnel
-- landing keep selling under the old name while the platform sells under the
-- new one.
