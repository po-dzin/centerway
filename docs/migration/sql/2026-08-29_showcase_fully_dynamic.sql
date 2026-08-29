-- CenterWay: the last two offers leave content.ts.
-- APPLIED 2026-08-29 to production over the session pooler.
-- Repo side: src/lib/platform/content.ts (the `programs` array keeps one
--            product and no courses), the deleted
--            src/app/(platform)/programs/{reboot,irem}/page.tsx, and
--            src/app/(platform)/programs/[slug]/page.tsx, which now resolves an
--            address against `program_slug` instead of `slug`.
--
-- THE ADDRESS IS NOT THE ROW NAME, and these two are why that had to be said
-- out loud. `short` is sold at /programs/reboot and `irem-gymnastics` at
-- /programs/irem — both names are years old, indexed, and printed on funnel
-- landings. Every course that had moved to the dynamic route before today
-- happened to have slug = program_slug, which made the difference invisible.
--
-- NEITHER GETS AN OFFER ROW, on purpose. Both are still delivered by a Telegram
-- bot, not by a course entitlement, and both keep charging the hand-written
-- PRODUCTS code (`short` 795 UAH, `irem` 3950 UAH) through resolveOfferCommerce.
-- Writing lms_course_offers rows for them would have quietly moved delivery.

BEGIN;

-- 1. short becomes findable.
-- Published since before the builder existed; it was `hidden` only because its
-- page was hand-written and the catalogue read that page, not this row.
-- sort_order 1 puts the shortest entry first, which is what the mini rail says.
UPDATE public.lms_courses
SET visibility = 'listed',
    sort_order = 1
WHERE slug = 'short';

-- 2. irem-gymnastics is published, and says its own name.
-- «ІВЕМ гімнастика» is a transliteration nobody sells under: the offer card,
-- the funnel, the bot and PRODUCTS.irem all say IREM. The tagline, summary and
-- results are the copy the deleted static page was already showing to buyers —
-- moved, not rewritten, so nothing a reader had seen disappears with the file.
UPDATE public.lms_courses
SET title = 'IREM Гімнастика',
    tagline = $tag$Щоденна рухова практика для контакту з тілом, м'якшої мобільності, енергії і зняття побутової напруги.$tag$,
    summary = to_jsonb($tag$IREM збирає прості рухові техніки у послідовну практику: розігрів, дихання, мобільність, робота з напруженням і повернення уваги до сигналів тіла. Сім днів ідуть по порядку, від простого до глибшого, щоб тіло встигало за темпом.$tag$::text),
    results = $json$[
      "зрозуміти, як вбудувати коротку практику руху в день",
      "помічати напруження раніше і м'якше з ним працювати",
      "підтримати відчуття легкості, мобільності і дихання",
      "рухатися за структурою без спортивного перевантаження",
      "мати опору для продовження після основного циклу"
    ]$json$::jsonb,
    status = 'published',
    visibility = 'listed'
WHERE slug = 'irem-gymnastics';

COMMIT;
