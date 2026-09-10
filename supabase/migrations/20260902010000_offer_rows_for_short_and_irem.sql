-- Строки офферов для short и irem — чтобы цена жила в одном месте
-- 02.09.2026
--
-- ЗАЧЕМ. Цену продукта писали два места: константы в `products.ts` (вход с
-- лендинга, `?product=short`) и таблица `lms_course_offers` (вход с витрины,
-- `course:<slug>`). Для way21 они разошлись: лендинг показывал 4100, а
-- списывал 1 ₴ из константы. `COURSE_CODE_ALIASES` в offers.ts был механизмом
-- против ровно этого, но покрывал один reset-day.
--
-- Чтобы алиас можно было расширить на short и irem, у их курсов должна быть
-- строка оффера: `loadCourseOfferFor` возвращает null без неё, и продукт
-- перестал бы продаваться. Эта миграция их заводит — ДО правки кода, потому
-- что до неё строки никто не читает, а после неё код на них обопрётся.
--
-- ЦИФРЫ — ТОЧНАЯ ТРАНСКРИПЦИЯ КОНСТАНТ, не новое ценообразование:
--   short: amount 795,  pixelContentName "Short Reboot"  (PRODUCTS.short)
--   irem:  amount 3950, pixelContentName "IREM"          (PRODUCTS.irem)
-- `pixel_content_name` переносится дословно: по нему склеена история отчётности
-- в Meta, переименование её порвёт.
--
-- list_amount = NULL, потому что constraint требует list_amount > amount, а у
-- обоих продуктов прейскурантная цена равна цене продажи. NULL здесь и значит
-- «скидки нет», а не «цена неизвестна».
--
-- access_lifetime = true: ни у одной из 5 существующих записей на эти два курса
-- нет `expires_at` (проверено), то есть доступ бессрочный — как у way21 и
-- reset-day. Это перенос текущего поведения, а не решение о сроке.
--
-- КОГО ЭТО НЕ КАСАЕТСЯ И ПОЧЕМУ. `lms_course_offers` уникальна по course_id —
-- один курс, один оффер. Поэтому сюда структурно не помещаются:
--   way21-support — второй оффер на тот же курс way21 (9000 ₴);
--   herbs         — вообще не курс (fulfilment «cabinet»).
-- Они остаются в константах, и это граница таблицы, а не недоделка.
--
-- КОД СТРОКИ — `course:<slug>`, не `short`/`irem`: `readOffer` ищет строку
-- ровно по `courseOfferCode(slug)`, и строка с любым другим кодом просто не
-- нашлась бы. Следствие такое же, как у reset-day: новые заказы с лендинга
-- лягут под канонический `course:short`, а не под `short`. Старые покупки от
-- этого не страдают — легаси-коды уже лежат в `entitlement_product_codes`
-- обоих курсов ({short,reboot} и {irem-gymnastics,ivem-gimnastika,irem}),
-- проверено перед применением.
--
-- ОТКАТ: delete from lms_course_offers where code in ('course:short','course:irem-gymnastics');
-- (только вместе с откатом COURSE_CODE_ALIASES, иначе продукты не продаются)

begin;

insert into public.lms_course_offers
  (course_id, code, amount, list_amount, currency, pixel_content_name, access_days, access_lifetime, active)
select c.id, 'course:short', 795, null, 'UAH', 'Short Reboot', null, true, true
  from public.lms_courses c
 where c.slug = 'short'
   and not exists (select 1 from public.lms_course_offers o where o.course_id = c.id);

insert into public.lms_course_offers
  (course_id, code, amount, list_amount, currency, pixel_content_name, access_days, access_lifetime, active)
select c.id, 'course:irem-gymnastics', 3950, null, 'UAH', 'IREM', null, true, true
  from public.lms_courses c
 where c.slug = 'irem-gymnastics'
   and not exists (select 1 from public.lms_course_offers o where o.course_id = c.id);

commit;

-- ПРОВЕРКА:
-- select c.slug, o.code, o.amount, o.pixel_content_name, o.access_lifetime
--   from lms_course_offers o join lms_courses c on c.id = o.course_id
--  where c.slug in ('short','irem-gymnastics');
