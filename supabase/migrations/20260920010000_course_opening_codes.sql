-- course_opening_codes: какие коды заказа открывают курс
-- 20.09.2026
--
-- ЗАЧЕМ. Курс открывался заказом, чей `product_code` был в массиве
-- `lms_courses.entitlement_product_codes` (или равен `course:<slug>`). Массив
-- заполнялся руками и держал на себе связи, у которых теперь есть своё место:
-- пакет супровода открывает way21 — это строка `experience_offer_items`; старые
-- коды `shlyah21`, `detox21` — строки `offer_aliases`.
--
-- ПРАВИЛО. Курс открывает заказ по любому коду оффера, который
--   · принадлежит вещи этого курса, или
--   · включает её через `experience_offer_items`,
-- а также по любому старому коду такого оффера. НЕАКТИВНЫЕ офферы считаются:
-- снятие оффера останавливает продажи, но не отменяет уже сделанные.
--
-- Массив на курсе не удаляется здесь: сервер объединяет его с этой вьюхой до
-- уборки, чтобы код, известный только массиву, не потерял доступ молча.
--
-- ОТКАТ: drop view public.course_opening_codes;

begin;

create or replace view public.course_opening_codes as
with openers as (
  select c.id as course_id, o.id as offer_id
    from public.lms_courses c
    join public.experience_offers o on o.experience_id = c.experience_id
  union
  select c.id, i.offer_id
    from public.lms_courses c
    join public.experience_offer_items i on i.experience_id = c.experience_id
)
select op.course_id, o.code
  from openers op
  join public.experience_offers o on o.id = op.offer_id
union
select op.course_id, a.code
  from openers op
  join public.offer_aliases a on a.offer_id = op.offer_id;

comment on view public.course_opening_codes is
  'Коды заказа, открывающие курс: офферы его вещи, офферы, включающие её через experience_offer_items, и их старые коды.';

revoke all on public.course_opening_codes from anon, authenticated;
grant select on public.course_opening_codes to service_role;

commit;

-- ПРОВЕРКА — совпадает ли с массивом, который она заменяет:
-- select c.slug,
--        array(select code from course_opening_codes v where v.course_id = c.id order by 1) as from_view,
--        c.entitlement_product_codes as from_array
--   from lms_courses c order by c.slug;
