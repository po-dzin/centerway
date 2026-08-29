-- CenterWay: IREM accepts the code it is actually sold under.
-- APPLIED 2026-08-29 to production over the session pooler.
-- Repo side: src/lib/products.ts — `short` and `irem` stop being delivered by a
--            Telegram bot and are served by the platform like every other
--            course.
--
-- THE BUG THIS CLOSES IS OLDER THAN THE CHANGE THAT EXPOSED IT. Access is not
-- stored; it is derived, by matching a paid order's product code against the
-- course's `entitlement_product_codes` (see ensureEnrollment). The IREM course
-- accepted `irem-gymnastics` and `ivem-gimnastika` — its row name today and its
-- row name yesterday — and never `irem`, which is the code every real purchase
-- has been filed under. While delivery was a Telegram bot nobody noticed: the
-- platform was not where the course was read.
--
-- Flipping fulfilment to the platform without this line would hand every past
-- and future IREM buyer a link to a course that refuses their order.
--
-- A CODE IS ADDED, NEVER SWAPPED. Same rule as the renames earlier today: the
-- array is the list of names a grant may have been written under, and dropping
-- one revokes access from whoever bought under it.

UPDATE public.lms_courses
SET entitlement_product_codes = array_append(entitlement_product_codes, 'irem')
WHERE slug = 'irem-gymnastics'
  AND NOT ('irem' = ANY (entitlement_product_codes));
