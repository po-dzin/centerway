-- Переименование адреса курса: novyi-kurs-5 → soul-daily-ritual
-- 02.09.2026 — ПРИМЕНЕНО В ПРОДЕ 02.09.2026
--
-- Состояние после применения (проверено):
--   lms_courses:       slug = program_slug = 'soul-daily-ritual'
--   lms_course_offers: code = 'course:soul-daily-ritual', amount 0
--   entitlement_product_codes = {course:novyi-kurs-5}
--   упоминаний старого слага в lms_courses и lms_course_offers — 0
--   /programs/soul-daily-ritual отдаёт 200, sitemap перевыпустился на новый
--   адрес, shelf:check проходит (9 курсов)
--
-- ЗАМЕЧЕНО ПРИ ПРИМЕНЕНИИ: правка через SQL не дёргает revalidateTag, поэтому
-- витрина ~2 минуты жила в рассинхроне — листинг уже показывал новый слаг, а
-- страницы обоих адресов отвечали по старому кэшу. Само сошлось по бэкстопу
-- `REVALIDATE_SECONDS = 120` в liveCatalog.ts. Для следующей такой правки: либо
-- заложить эти две минуты, либо дёрнуть ревалидацию тега после коммита.
--
-- ПОЧЕМУ РУКАМИ, А НЕ ИЗ БИЛДЕРА. `courseSlugCanChange` разрешает менять адрес
-- только у инертного черновика: draft + hidden + не на ревью + нет записей.
-- Этот курс опубликован, listed и имеет 2 записи, так что билдер откажет — и
-- откажет правильно. Смена публичного адреса это решение, а не редактирование.
--
-- ПОЧЕМУ ЭТО БЕЗОПАСНО ИМЕННО СЕЙЧАС. Курс «Soul Daily Ritual» доехал до
-- витрины по слагу, который билдер выдал по умолчанию: страница отдаёт 200,
-- курс в листинге и в sitemap.xml, а `meta robots` на /programs/* нет вовсе.
-- При этом по коду `course:novyi-kurs-5` заведено 14 заказов и ВСЕ они в
-- статусе `created` — ни одной оплаты. Записи на курс висят на `course_id`,
-- а не на слаге, поэтому их переименование не касается. Дешевле этого момента
-- уже не будет: адрес станет постоянным, как только его кто-то обойдёт.
--
-- ЧТО ОСТАЁТСЯ ПОСЛЕ. Четырнадцать `created`-заказов сохраняют старый
-- product_code. Их история не переписывается — вместо этого старый код кладётся
-- в `entitlement_product_codes`, штатный механизм легаси-кодов (его читает
-- `resolveEntitlement` через `course.entitlementProductCodes`). Если один из
-- этих заказов когда-нибудь всё же оплатят, покупатель получит курс, а не
-- пустую полку.
--
-- ОТКАТ: те же три UPDATE со значениями наоборот; entitlement_product_codes
-- вернуть в '{}'. Данных не удаляется, всё обратимо.

begin;

-- 1. Адрес курса. program_slug это адрес витрины (/programs/<program_slug>),
--    и он равен слагу — значит меняются оба.
update public.lms_courses
   set slug = 'soul-daily-ritual',
       program_slug = 'soul-daily-ritual'
 where slug = 'novyi-kurs-5'
   and program_slug = 'novyi-kurs-5';

-- 2. Страховка для четырнадцати незакрытых заказов под старым кодом.
update public.lms_courses
   set entitlement_product_codes = array['course:novyi-kurs-5']
 where slug = 'soul-daily-ritual'
   and entitlement_product_codes = '{}';

-- 3. Код оффера. `code` только UNIQUE, никакого триггера от слага, но
--    `courseOfferCode(slug)` собирает именно эту строку при чтении — если её
--    не поменять, витрина перестанет находить цену.
update public.lms_course_offers
   set code = 'course:soul-daily-ritual'
 where code = 'course:novyi-kurs-5';

commit;

-- ПРОВЕРКА (должно быть: курс на новом слаге, оффер на новом коде,
-- старый код в entitlement_product_codes, старых упоминаний ноль):
--
-- select c.slug, c.program_slug, c.entitlement_product_codes, o.code, o.amount
--   from lms_courses c join lms_course_offers o on o.course_id = c.id
--  where c.slug = 'soul-daily-ritual';
--
-- select count(*) from lms_courses where slug = 'novyi-kurs-5';           -- 0
-- select count(*) from lms_course_offers where code like '%novyi-kurs-5'; -- 0
