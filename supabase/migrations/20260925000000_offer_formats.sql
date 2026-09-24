-- offer_formats: одна программа — несколько способов её пройти
-- 25.09.2026
--
-- ЗАЧЕМ. Шлях 21 продаётся тремя форматами: самостоятельно, в группе потока и
-- с индивидуальным сопровождением. Группа и сопровождение открывают ещё и
-- «Розвантажувальний день» и Short (набор: `experience_offer_items`). Страница
-- программы показывает форматы рядом, автор собирает их в билдере, цену
-- подтверждает владелец. План: https://claude.ai/artifact/NLQYo91GUW3V1fTpuktt8d
--
-- ЧТО МЕНЯЕТСЯ.
--   · `experience_offers` узнаёт формат (`format`), его название и описание,
--     порядок на странице, дату старта потока (для группы) и путь согласования:
--     `review_status` draft → proposed → approved | declined. Автор пишет
--     `proposed_amount`; живую `amount` ставит только владелец при одобрении.
--     Существующие строки — `approved`: они уже продаются.
--   · Пока оффер не одобрен, у checkout-оффера может не быть суммы: это
--     предложение, а не товар. Витрина и чекаут читают только approved + active.
--   · `lms_modules.linked_course_slug` — модуль, который ведёт в другую
--     программу. Контент не копируется: прогресс, читалка и адрес остаются у
--     вложенной программы.
--   · `way21-support` переезжает из отдельной вещи-пакета в формат Шляху 21.
--     Зеркало `product_offers` при обновлении `experience_id` не трогает, так
--     что переезд не откатится при следующей правке цены в каталоге.
--   · Заказ индивидуального формата ждёт исполнения (`pending`), как раньше
--     ждал заказ пакета: решает теперь формат оффера, а не вид вещи.
--
-- ОТКАТ:
--   alter table public.lms_modules drop column linked_course_slug;
--   alter table public.experience_offers drop column format, drop column label, drop column summary,
--     drop column sort_order, drop column cohort_starts_on, drop column review_status,
--     drop column proposed_amount, drop column proposed_by, drop column proposed_at,
--     drop column reviewed_by, drop column reviewed_at;
--   (и вернуть experience_offers_amount_fits_mode и orders_link_offer из 20260924020000)

begin;

-- ─────────────────────────────────────────
-- 1. Формат оффера
-- ─────────────────────────────────────────
alter table public.experience_offers
  add column if not exists format           text        null,
  add column if not exists label            jsonb       null,
  add column if not exists summary          jsonb       null,
  add column if not exists sort_order       integer     not null default 0,
  add column if not exists cohort_starts_on date        null,
  add column if not exists review_status    text        not null default 'approved',
  add column if not exists proposed_amount  integer     null,
  add column if not exists proposed_by      uuid        null,
  add column if not exists proposed_at      timestamptz null,
  add column if not exists reviewed_by      uuid        null,
  add column if not exists reviewed_at      timestamptz null;

alter table public.experience_offers drop constraint if exists experience_offers_format_known;
alter table public.experience_offers add constraint experience_offers_format_known
  check (format is null or format in ('self', 'group', 'individual'));

alter table public.experience_offers drop constraint if exists experience_offers_review_known;
alter table public.experience_offers add constraint experience_offers_review_known
  check (review_status in ('draft', 'proposed', 'approved', 'declined'));

alter table public.experience_offers drop constraint if exists experience_offers_proposed_amount_positive;
alter table public.experience_offers add constraint experience_offers_proposed_amount_positive
  check (proposed_amount is null or proposed_amount > 0);

-- Неодобренное не продаётся: активным может быть только одобренный оффер.
alter table public.experience_offers drop constraint if exists experience_offers_active_needs_approval;
alter table public.experience_offers add constraint experience_offers_active_needs_approval
  check (not active or review_status = 'approved');

-- Сумма обязательна чекауту, но только когда он одобрен: предложение автора
-- до решения владельца суммы не имеет.
alter table public.experience_offers drop constraint if exists experience_offers_amount_fits_mode;
alter table public.experience_offers add constraint experience_offers_amount_fits_mode check (
  (mode = 'checkout' and ((amount is not null and amount > 0) or (review_status <> 'approved' and amount is null)))
  or (mode = 'free' and amount = 0)
  or (mode = 'lead' and (amount is null or amount > 0))
);

comment on column public.experience_offers.format is
  'Способ пройти программу: self | group | individual. NULL — оффер вне форматов (травы, консультация).';
comment on column public.experience_offers.label is
  '{uk,en} название формата на странице. NULL — название по формату по умолчанию.';
comment on column public.experience_offers.summary is
  '{uk,en} что даёт формат, одной-двумя фразами. Состав наборов показывается отдельно, из experience_offer_items.';
comment on column public.experience_offers.cohort_starts_on is
  'День 1 потока для группового формата; копируется в lms_enrollments.cohort_starts_on покупателя.';
comment on column public.experience_offers.review_status is
  'draft → proposed → approved | declined. Витрина и чекаут видят только approved + active.';
comment on column public.experience_offers.proposed_amount is
  'Цена, которую предложил автор. Живую amount ставит владелец при одобрении и может её изменить.';

create index if not exists idx_experience_offers_review
  on public.experience_offers (review_status) where review_status in ('proposed');

-- ─────────────────────────────────────────
-- 2. Порядок в наборе
-- ─────────────────────────────────────────
alter table public.experience_offer_items
  add column if not exists sort_order integer not null default 0;

-- ─────────────────────────────────────────
-- 3. Модуль-ссылка на другую программу
-- ─────────────────────────────────────────
alter table public.lms_modules
  add column if not exists linked_course_slug text null;

alter table public.lms_modules drop constraint if exists lms_modules_linked_slug_shape;
alter table public.lms_modules add constraint lms_modules_linked_slug_shape
  check (linked_course_slug is null or linked_course_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

comment on column public.lms_modules.linked_course_slug is
  'Модуль ведёт в другую программу (slug её курса). Уроков у такого модуля нет; доступ — по правам вложенной программы.';

-- ─────────────────────────────────────────
-- 4. Исполнение: решает формат
-- ─────────────────────────────────────────
create or replace function public.orders_link_offer()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  found_offer uuid;
  found_experience uuid;
  found_format text;
  found_kind text;
begin
  if new.product_code is null then return new; end if;
  if tg_op = 'UPDATE' and new.product_code is not distinct from old.product_code and new.offer_id is not null then
    return new;
  end if;

  select o.id, o.experience_id, o.format into found_offer, found_experience, found_format
    from public.experience_offers o where o.code = lower(new.product_code);
  if found_offer is null then
    select o.id, o.experience_id, o.format into found_offer, found_experience, found_format
      from public.offer_aliases a join public.experience_offers o on o.id = a.offer_id
     where a.code = lower(new.product_code);
  end if;
  if found_offer is null then return new; end if;

  new.offer_id := found_offer;
  new.experience_id := found_experience;

  -- Услуга и посылка ждут исполнения с первой минуты; контент — нет.
  -- Индивидуальный формат — это услуга, даже когда вещь у него — курс.
  if new.fulfilment_status is null then
    select e.kind into found_kind from public.experiences e where e.id = found_experience;
    if found_kind in ('consultation', 'package', 'physical') or found_format = 'individual' then
      new.fulfilment_status := 'pending';
    end if;
  end if;
  return new;
end $$;

-- ─────────────────────────────────────────
-- 5. Данные: форматы Шляху 21 и «Природного тіла»
-- ─────────────────────────────────────────
-- Самостоятельный — это оффер курса, который уже продаётся.
update public.experience_offers
   set format = 'self', sort_order = 1
 where code in ('course:way21', 'course:natural-body') and format is null;

-- Сопровождение становится форматом Шляху 21. Заказы, которые уже на него
-- сделаны, указывают на вещь-пакет; это правда о том моменте, и они остаются.
update public.experience_offers o
   set experience_id = (select id from public.experiences where slug = 'way21'),
       format = 'individual',
       sort_order = 3
 where o.code = 'way21-support'
   and exists (select 1 from public.experiences where slug = 'way21');

-- Пакет больше ничего не продаёт; строку реестра не удаляем — на неё
-- ссылаются прошлые заказы.
update public.experiences set listed = false where slug = 'way21-support';

-- Группа Шляху 21: поток с 01.10.2026, цена как у самостоятельного.
insert into public.experience_offers
  (experience_id, code, mode, amount, list_amount, currency, access_days, access_lifetime,
   pixel_content_name, active, format, sort_order, cohort_starts_on, review_status,
   invoice_heading, invoice_description)
select
  self.experience_id, 'way21-group', 'checkout', self.amount, self.list_amount, self.currency,
  self.access_days, self.access_lifetime, 'Way21 Group', true, 'group', 2, date '2026-10-01', 'approved',
  '{"uk":"Шлях 21 — у групі потоку","en":"Way 21 — group cohort"}'::jsonb,
  '{"uk":"Оплата детокс-програми \"Шлях 21\" у форматі групи потоку від Centerway. Старт потоку 1 жовтня. Після успішної оплати програма відкриється у вашому кабінеті на платформі разом із міні-курсами \"Розвантажувальний день\" і Short Reboot. Підтримка: якщо виникли питання - напишіть нам, допоможемо швидко.","en":"Way 21 detox program payment by Centerway, group cohort format. The cohort starts on 1 October. After payment the program opens in your account on the platform together with the mini courses Reset Day and Short Reboot. Support: if you have questions, message us and we will help quickly."}'::jsonb
from public.experience_offers self
where self.code = 'course:way21'
on conflict (code) do nothing;

-- Группа и сопровождение «Природного тіла»: та же схема, но цену ставит
-- владелец — поэтому черновиками, не в продаже.
insert into public.experience_offers
  (experience_id, code, mode, amount, currency, active, format, sort_order, review_status)
select e.id, v.code, v.mode, null, 'UAH', false, v.format, v.sort_order, 'draft'
  from public.experiences e,
       (values ('natural-body-group', 'checkout', 'group', 2),
               ('natural-body-support', 'lead', 'individual', 3)) as v(code, mode, format, sort_order)
 where e.slug = 'natural-body'
on conflict (code) do nothing;

-- Что открывают группа и сопровождение, кроме самой программы.
insert into public.experience_offer_items (offer_id, experience_id, sort_order)
select o.id, e.id, v.sort_order
  from (values ('way21-group', 'reset-day', 1), ('way21-group', 'reboot', 2),
               ('way21-support', 'reset-day', 1), ('way21-support', 'reboot', 2),
               ('natural-body-group', 'reset-day', 1), ('natural-body-group', 'reboot', 2),
               ('natural-body-support', 'reset-day', 1), ('natural-body-support', 'reboot', 2))
       as v(code, slug, sort_order)
  join public.experience_offers o on o.code = v.code
  join public.experiences e on e.slug = v.slug
on conflict (offer_id, experience_id) do update set sort_order = excluded.sort_order;

-- Сопровождение теперь оффер самого Шляху 21 — строка «пакет открывает way21»
-- стала тавтологией.
delete from public.experience_offer_items i
 using public.experience_offers o, public.experiences e
 where i.offer_id = o.id and i.experience_id = e.id
   and o.code = 'way21-support' and e.slug = 'way21';

commit;

-- ПРОВЕРКА:
-- select e.slug, o.code, o.format, o.mode, o.amount, o.review_status, o.active, o.cohort_starts_on
--   from experience_offers o join experiences e on e.id = o.experience_id where o.format is not null order by 1, o.sort_order;
-- select o.code, e.slug from experience_offer_items i join experience_offers o on o.id = i.offer_id
--   join experiences e on e.id = i.experience_id order by 1, i.sort_order;

-- ─────────────────────────────────────────
-- 6. Reset Day и Short внутри Шляху 21 и «Природного тіла»
-- ─────────────────────────────────────────
-- Модули-ссылки в конце материалов. id те же, что в data/courses/*.json, чтобы
-- сид и база не разошлись. Открывает их право на вложенную программу, а не на
-- родительскую: самостоятельный формат видит их закрытыми.
begin;

insert into public.lms_modules (id, course_id, slug, title, "order", reference, linked_course_slug)
select v.id::uuid, c.id, v.slug, v.title, v.ord, true, v.linked
  from (values
    ('way21',        'c4a91d3e-0000-4000-8000-000000000016', 'reset-day', 'Розвантажувальний день', 6, 'reset-day'),
    ('way21',        'c4a91d3e-0000-4000-8000-000000000017', 'short',     'Short-Перезавантаження', 7, 'short'),
    ('natural-body', '4f2b8c1e-7a3d-5e90-b6c4-2d1e8f0a9b31', 'reset-day', 'Розвантажувальний день', 6, 'reset-day'),
    ('natural-body', '4f2b8c1e-7a3d-5e90-b6c4-2d1e8f0a9b32', 'short',     'Short-Перезавантаження', 7, 'short')
  ) as v(course, id, slug, title, ord, linked)
  join public.lms_courses c on c.slug = v.course
on conflict (id) do nothing;

commit;
