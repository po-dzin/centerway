-- «Природне тіло» продаётся одним способом — самостійно (2026-09-26).
--
-- Группа и сопровождение были заведены черновиками 25.09 (`20260925000000_offer_formats`)
-- в ожидании цены. Владелец решил: этих форматов у программы нет. Черновики
-- удаляются, а не остаются неактивными, — черновик в админке читается как
-- «ждёт цены», то есть как решение, которое ещё предстоит.
--
-- Заказов под этими кодами нет (active = false с рождения, цены не было).
-- `experience_offer_items` уходят каскадом; `orders.offer_id` — `on delete set null`.
--
-- Откат: пересоздать строки из `20260925000000_offer_formats.sql` (блок «Группа и
-- сопровождение „Природного тіла“» и строки natural-body-* в `experience_offer_items`).

begin;

delete from public.offer_aliases a
 using public.experience_offers o
 where a.offer_id = o.id and o.code in ('natural-body-group', 'natural-body-support');

delete from public.experience_offers
 where code in ('natural-body-group', 'natural-body-support');

commit;
