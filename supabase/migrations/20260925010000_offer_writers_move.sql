-- offer_writers_move: цену пишут только в experience_offers
-- 25.09.2026
--
-- ЗАЧЕМ. С 20.09 цены читались из `experience_offers`, а писались в две старые
-- таблицы — `lms_course_offers` (каталог курсов, срок доступа из билдера) и
-- `product_offers` (пакеты и заявки), — откуда триггеры копировали их в новую.
-- Это было переходное зеркало. Теперь каталог, цены продуктов, срок доступа,
-- скрипт `course-offer.mjs` и одобрение форматов пишут в `experience_offers`
-- напрямую (коммит «Step 2: every price is written to experience_offers»).
--
-- ЧТО ДЕЛАЕТ. Снимает оба триггера и их функции. Старые таблицы остаются как
-- архив того, что продавалось до 25.09: удалять их в той же волне значит
-- терять страховку, если найдётся читатель, которого никто не заметил. Их
-- удаление — отдельный шаг уборки вместе с `entitlement_product_codes`.
--
-- БЕЗ «ПОСЛЕДНЕГО ПРОГОНА» зеркала, намеренно: триггер писал в той же
-- транзакции, так что новая таблица ничего не пропустила, а прогон после того,
-- как новый код уже записал цену напрямую, вернул бы её к старой из архива.
--
-- ПОСЛЕ ДЕПЛОЯ, не раньше: код старше этой волны пишет цены в старые таблицы,
-- и без триггеров его правки не дошли бы до experience_offers, откуда читает
-- новый код.
--
-- ОТКАТ: восстановить функции и триггеры из 20260924020000_experience_offers.sql §3–4.

begin;

drop trigger if exists lms_course_offers_mirror on public.lms_course_offers;
drop trigger if exists product_offers_mirror on public.product_offers;
drop function if exists public.experience_offers_mirror_course();
drop function if exists public.experience_offers_mirror_product();

comment on table public.lms_course_offers is
  'АРХИВ с 25.09.2026. Цены курсов пишутся в experience_offers (code = course:<slug>). Не писать.';
comment on table public.product_offers is
  'АРХИВ с 25.09.2026. Цены продуктов пишутся в experience_offers. Не писать.';

commit;
