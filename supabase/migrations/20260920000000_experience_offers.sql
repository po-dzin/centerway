-- experience_offers: одна таблица цен для всего реестра
-- 20.09.2026
--
-- ЗАЧЕМ. Цена жила в трёх местах: `lms_course_offers` (курс, один оффер на курс),
-- `product_offers` (то, что в первую таблицу структурно не влезло: второй оффер
-- на way21, травы, заявки) и константа `PRODUCTS` (проза счёта WayForPay и цены
-- «про запас»). Три хранилища — три двери к одному чекауту, и 02.09 это уже
-- стоило продажи way21 за 1 ₴ при цене 4100 на лендинге.
--
-- ЧТО МЕНЯЕТСЯ ПО СУТИ. Оффер принадлежит ВЕЩИ (`experiences`), и у вещи их
-- может быть НЕСКОЛЬКО: «Шлях 21» самостоятельно и с сопровождением, ранняя
-- цена и обычная. Уникальность по курсу, ради которой существовала вторая
-- таблица, снята. `experience_offer_items` говорит, что оффер открывает КРОМЕ
-- своей вещи: пакет супровода открывает курс way21 — сегодня эту связь держит
-- массив `entitlement_product_codes` на курсе.
--
-- ПРОЗА СЧЁТА переезжает из `PRODUCTS` в `invoice_heading` / `invoice_description`
-- ({uk,en}). Перенесена ДОСЛОВНО, скриптом из константы. NULL — «собрать из
-- заголовка курса», как `loadCourseOfferFor` делает сейчас.
--
-- ПЕРЕХОДНЫЙ ПЕРИОД: ЗЕРКАЛО. Писатели (каталог в админке, срок доступа из
-- билдера) пока пишут в старые таблицы. Чтобы новая не протухала, два триггера
-- зеркалят старые строки в неё по `code`. Это одностороннее зеркало и оно
-- временное: когда каталог начнёт писать сюда напрямую, триггеры удаляются, а
-- старые таблицы — в последнем шаге (`docs/experiences-unification-2026-09-17.md` §4).
-- Пока зеркало стоит, руками эту таблицу править нельзя только в зеркалимых
-- колонках; `invoice_*` и `share_pct` зеркало не трогает.
--
-- КОДЫ. `offer_aliases`: любой код, под которым это когда-либо продавалось или
-- выдавало доступ, находит ОФФЕР. Отдельно от `experience_aliases` (имя → вещь):
-- при нескольких офферах на вещь код, указывающий на вещь, неоднозначен.
--
-- ЗАКАЗ узнаёт вещь и оффер (`orders.experience_id`, `offer_id`) и получает
-- `fulfilment_status`: услуга и посылка ПОТРЕБЛЯЮТСЯ, поэтому состояние
-- исполнения живёт на покупке, а не на праве доступа. Вторая консультация —
-- второй заказ. NULL — заказ контента, исполнять нечего.
--
-- ОТКАТ:
--   drop trigger lms_course_offers_mirror on public.lms_course_offers;
--   drop trigger product_offers_mirror on public.product_offers;
--   alter table public.orders drop column experience_id, drop column offer_id, drop column fulfilment_status;
--   drop table public.offer_aliases, public.experience_offer_items, public.experience_offers;
--   drop function public.experience_offers_mirror_course(), public.experience_offers_mirror_product(),
--                 public.experience_offers_touch_updated_at(), public.orders_link_offer();

begin;

-- ─────────────────────────────────────────
-- 1. Офферы
-- ─────────────────────────────────────────
create table if not exists public.experience_offers (
  id                   uuid primary key default gen_random_uuid(),
  experience_id        uuid        not null references public.experiences (id) on delete cascade,
  code                 text        not null unique,
  mode                 text        not null,
  amount               integer     null,
  list_amount          integer     null,
  currency             text        not null default 'UAH',
  access_days          integer     null,
  access_lifetime      boolean     not null default false,
  invoice_heading      jsonb       null,
  invoice_description  jsonb       null,
  share_pct            numeric(5,2) null,
  pixel_content_name   text        null,
  active               boolean     not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint experience_offers_mode_known check (mode in ('checkout', 'lead', 'free')),
  -- Три состояния остаются тремя: сумма для шлюза, «ціна за запитом», бесплатно.
  constraint experience_offers_amount_fits_mode check (
    (mode = 'checkout' and amount is not null and amount > 0)
    or (mode = 'free' and amount = 0)
    or (mode = 'lead' and (amount is null or amount > 0))
  ),
  constraint experience_offers_list_amount_positive check (list_amount is null or list_amount > 0),
  constraint experience_offers_access_days_positive check (access_days is null or access_days > 0),
  constraint experience_offers_access_one_rule check (not (access_lifetime and access_days is not null)),
  constraint experience_offers_share_pct_range check (share_pct is null or (share_pct >= 0 and share_pct <= 100))
);

comment on table public.experience_offers is
  'Что и почём. Несколько офферов на вещь разрешены. Пока писатели не переехали, строки зеркалятся из lms_course_offers и product_offers.';
comment on column public.experience_offers.amount is
  'NULL = «ціна за запитом» (только mode=lead). 0 = бесплатно (только mode=free).';
comment on column public.experience_offers.share_pct is
  'Доля автора в процентах для этого оффера. NULL — ставка автора по умолчанию.';
comment on column public.experience_offers.invoice_heading is
  '{uk,en} строка счёта у шлюза. NULL — собрать из заголовка курса.';

create index if not exists idx_experience_offers_experience on public.experience_offers (experience_id) where active;

create or replace function public.experience_offers_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists experience_offers_touch on public.experience_offers;
create trigger experience_offers_touch
  before update on public.experience_offers
  for each row execute function public.experience_offers_touch_updated_at();

create table if not exists public.experience_offer_items (
  offer_id       uuid not null references public.experience_offers (id) on delete cascade,
  experience_id  uuid not null references public.experiences (id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (offer_id, experience_id)
);

comment on table public.experience_offer_items is
  'Что оффер открывает КРОМЕ своей вещи: набор, пакет с курсом внутри. У обычного оффера строк нет.';

create table if not exists public.offer_aliases (
  code        text primary key,
  offer_id    uuid not null references public.experience_offers (id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint offer_aliases_lowercase check (code = lower(code))
);

comment on table public.offer_aliases is
  'Старые коды чекаута и доступа → оффер. Живой code оффера сюда не пишется и всегда побеждает алиас.';

create index if not exists idx_offer_aliases_offer on public.offer_aliases (offer_id);

-- ─────────────────────────────────────────
-- 2. Права: цена — предмет владельца, как и была
-- ─────────────────────────────────────────
alter table public.experience_offers enable row level security;
alter table public.experience_offer_items enable row level security;
alter table public.offer_aliases enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['experience_offers', 'experience_offer_items', 'offer_aliases'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = t || '_admin_all') then
      execute format(
        'create policy %I on public.%I for all using (public.get_my_role() = ''admin'') with check (public.get_my_role() = ''admin'')',
        t || '_admin_all', t
      );
    end if;
  end loop;
end $$;

grant all on public.experience_offers, public.experience_offer_items, public.offer_aliases to service_role;

-- ─────────────────────────────────────────
-- 3. Зеркало старых таблиц (переходное)
-- ─────────────────────────────────────────
create or replace function public.experience_offers_mirror_course()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target uuid;
begin
  if tg_op = 'DELETE' then
    delete from public.experience_offers where code = old.code;
    return old;
  end if;

  select c.experience_id into target from public.lms_courses c where c.id = new.course_id;
  if target is null then return new; end if;

  insert into public.experience_offers
    (experience_id, code, mode, amount, list_amount, currency, access_days, access_lifetime, pixel_content_name, active)
  values
    (target, new.code, case when new.amount = 0 then 'free' else 'checkout' end, new.amount, new.list_amount,
     new.currency, new.access_days, new.access_lifetime, new.pixel_content_name, new.active)
  on conflict (code) do update set
    experience_id = excluded.experience_id,
    mode = excluded.mode,
    amount = excluded.amount,
    list_amount = excluded.list_amount,
    currency = excluded.currency,
    access_days = excluded.access_days,
    access_lifetime = excluded.access_lifetime,
    pixel_content_name = excluded.pixel_content_name,
    active = excluded.active;

  if tg_op = 'UPDATE' and old.code is distinct from new.code then
    delete from public.experience_offers where code = old.code;
  end if;
  return new;
end $$;

create or replace function public.experience_offers_mirror_product()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target uuid;
begin
  if tg_op = 'DELETE' then
    delete from public.experience_offers where code = old.code;
    return old;
  end if;

  select e.id into target from public.experiences e where e.slug = new.code;
  -- Строка цены без вещи в реестре: зеркалить некуда. Вещь заводит владелец.
  if target is null then return new; end if;

  insert into public.experience_offers
    (experience_id, code, mode, amount, list_amount, currency, pixel_content_name, active)
  values
    (target, new.code,
     -- «за запитом» — заявка, какой бы kind ни стоял: чекаута без суммы не бывает.
     case when new.kind = 'lead' or new.amount is null then 'lead' else 'checkout' end,
     new.amount, new.list_amount, new.currency, new.pixel_content_name, new.active)
  on conflict (code) do update set
    mode = excluded.mode,
    amount = excluded.amount,
    list_amount = excluded.list_amount,
    currency = excluded.currency,
    pixel_content_name = excluded.pixel_content_name,
    active = excluded.active;
  return new;
end $$;

-- ─────────────────────────────────────────
-- 4. Backfill офферов — тем же кодом, что потом держит их в актуальном виде
-- ─────────────────────────────────────────
drop trigger if exists lms_course_offers_mirror on public.lms_course_offers;
create trigger lms_course_offers_mirror
  after insert or update or delete on public.lms_course_offers
  for each row execute function public.experience_offers_mirror_course();

drop trigger if exists product_offers_mirror on public.product_offers;
create trigger product_offers_mirror
  after insert or update or delete on public.product_offers
  for each row execute function public.experience_offers_mirror_product();

-- «Пустой» UPDATE прогоняет каждую строку через зеркало: один путь для
-- backfill и для жизни, а не два, которые могут разойтись.
update public.lms_course_offers set code = code;
update public.product_offers set code = code;

-- ─────────────────────────────────────────
-- 5. Проза счёта — дословно из PRODUCTS (src/lib/products.ts на 20.09.2026,
--    уже без обещания «вхід у Telegram-бот»: с 29.08 всё выдаётся на платформе)
-- ─────────────────────────────────────────
update public.experience_offers o
   set invoice_heading = p.heading, invoice_description = p.description
  from (values
  ('course:short', '{"uk":"Short Reboot — онлайн-курс","en":"Short Reboot — online course"}'::jsonb, '{"uk":"Оплата онлайн-курсу \"Short Reboot\" від Centerway. Після успішної оплати курс відкриється у вашому кабінеті на платформі - там уроки, матеріали і подальші кроки. Підтримка: якщо виникли питання - напишіть нам, допоможемо швидко.","en":"Online course payment by Centerway. After successful payment the course opens in your account on the platform, with its lessons, materials and next steps. Support: if you have questions, message us and we will help quickly."}'::jsonb),
  ('course:irem-gymnastics', '{"uk":"ІВЕМ-гімнастика — онлайн-система","en":"IREM gymnastics — online system"}'::jsonb, '{"uk":"Оплата онлайн-системи \"ІВЕМ-гімнастика\" від Centerway. Після успішної оплати система відкриється у вашому кабінеті на платформі - там уроки, розбори вправ і подальші кроки. Підтримка: якщо виникли питання - напишіть нам, допоможемо швидко.","en":"Online system payment by Centerway. After successful payment the system opens in your account on the platform, with its lessons, exercise breakdowns and next steps. Support: if you have questions, message us and we will help quickly."}'::jsonb),
  ('course:way21', '{"uk":"Шлях 21 — інтегративна детокс-програма","en":"Way 21 — integrative detox program"}'::jsonb, '{"uk":"Оплата детокс-програми \"Шлях 21\" від Centerway. Після успішної оплати програма відкриється у вашому кабінеті на платформі - там уроки, матеріали і подальші кроки. Підтримка: якщо виникли питання - напишіть нам, допоможемо швидко.","en":"Detox program payment by Centerway. After successful payment the program opens in your account on the platform, with its lessons, materials and next steps. Support: if you have questions, message us and we will help quickly."}'::jsonb),
  ('course:reset-day', '{"uk":"Розвантажувальний день — міні-курс","en":"Reset Day — mini course"}'::jsonb, '{"uk":"Оплата міні-курсу \"Розвантажувальний день\" від Centerway. Після успішної оплати міні-курс відкриється у вашому кабінеті на платформі - там уроки, матеріали і подальші кроки. Підтримка: якщо виникли питання - напишіть нам, допоможемо швидко.","en":"Mini course payment by Centerway. After successful payment the mini course opens in your account on the platform, with its lessons, materials and next steps. Support: if you have questions, message us and we will help quickly."}'::jsonb),
  ('way21-support', '{"uk":"Шлях 21 — індивідуальний супровід","en":"Way 21 — guided package"}'::jsonb, '{"uk":"Оплата пакета \"Шлях 21 — індивідуальний супровід\" від Centerway: програма детоксу з 2 особистими консультаціями та персональним веденням. Після оплати програма відкриється у вашому кабінеті на платформі, а час консультацій узгодимо з вами особисто. Підтримка: якщо виникли питання - напишіть нам, допоможемо швидко.","en":"Guided package payment by Centerway: the detox program with 2 personal consultations and individual guidance. After payment the program opens in your account on the platform, and we arrange the consultation times with you personally. Support: if you have questions, message us and we will help quickly."}'::jsonb),
  ('herbs', '{"uk":"Фітозбір — індивідуальний підбір","en":"Herbal blend — individual selection"}'::jsonb, '{"uk":"Оплата індивідуального підбору фітозбору від Centerway. Після успішної оплати відкриється сторінка підтвердження та кнопка переходу до продукту в кабінеті — там же будуть подальші інструкції. Підтримка: якщо виникли питання - напишіть нам, допоможемо швидко.","en":"Individual herbal blend payment by Centerway. After successful payment, a confirmation page opens with a button to the product in the cabinet and next steps. Support: if you have questions, message us and we will help quickly."}'::jsonb)
  ) as p(code, heading, description)
 where o.code = p.code and o.invoice_heading is null;

-- ─────────────────────────────────────────
-- 6. Что пакет открывает кроме себя
-- ─────────────────────────────────────────
insert into public.experience_offer_items (offer_id, experience_id)
select o.id, e.id
  from public.experience_offers o, public.experiences e
 where o.code = 'way21-support' and e.slug = 'way21'
on conflict do nothing;

-- ─────────────────────────────────────────
-- 7. Старые коды → оффер
-- ─────────────────────────────────────────
-- Источники: normalizeProduct и COURSE_CODE_ALIASES (код), entitlement_product_codes
-- (база). Код, совпавший с живым code оффера, пропускается: живой побеждает.
insert into public.offer_aliases (code, offer_id)
select a.alias, o.id
from (values
  ('short',            'course:short'),
  ('reboot',           'course:short'),
  ('irem',             'course:irem-gymnastics'),
  ('irem-gymnastics',  'course:irem-gymnastics'),
  ('ivem-gimnastika',  'course:irem-gymnastics'),
  ('way21',            'course:way21'),
  ('detox21',          'course:way21'),
  ('shlyah21',         'course:way21'),
  ('reset-day',        'course:reset-day'),
  ('reset_day',        'course:reset-day'),
  ('reset',            'course:reset-day'),
  ('rozvantazhennya',  'course:reset-day'),
  ('mini-detox',       'course:reset-day'),
  ('natural-body',     'course:natural-body'),
  ('ideal-body',       'course:natural-body'),
  ('ideal_body',       'course:natural-body'),
  ('idealne-tilo',     'course:natural-body'),
  ('course:novyi-kurs-5', 'course:soul-daily-ritual'),
  ('way21_support',    'way21-support'),
  ('consultation',     'consult'),
  ('irem_individual',  'irem-individual'),
  ('irem-support',     'irem-individual')
) as a(alias, code)
join public.experience_offers o on o.code = a.code
where not exists (select 1 from public.experience_offers live where live.code = a.alias)
on conflict (code) do nothing;

-- ─────────────────────────────────────────
-- 8. Заказ узнаёт вещь и оффер
-- ─────────────────────────────────────────
alter table public.orders
  add column if not exists experience_id uuid null references public.experiences (id),
  add column if not exists offer_id uuid null references public.experience_offers (id) on delete set null,
  add column if not exists fulfilment_status text null;

alter table public.orders drop constraint if exists orders_fulfilment_status_known;
alter table public.orders add constraint orders_fulfilment_status_known
  check (fulfilment_status is null or fulfilment_status in ('pending', 'scheduled', 'done', 'cancelled'));

comment on column public.orders.fulfilment_status is
  'Исполнение услуги или посылки: pending → scheduled → done | cancelled. NULL — заказ контента, исполнять нечего.';

create index if not exists idx_orders_experience on public.orders (experience_id) where experience_id is not null;
create index if not exists idx_orders_fulfilment on public.orders (fulfilment_status) where fulfilment_status is not null;

-- Связь ставит база, по коду, в момент записи заказа. Пять мест в коде пишут
-- orders.product_code (pay/start, orders/create, ручная продажа, скрипты,
-- бэкфилл покупок); одно правило здесь надёжнее пяти правок там.
create or replace function public.orders_link_offer()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  found_offer uuid;
  found_experience uuid;
  found_kind text;
begin
  if new.product_code is null then return new; end if;
  if tg_op = 'UPDATE' and new.product_code is not distinct from old.product_code and new.offer_id is not null then
    return new;
  end if;

  select o.id, o.experience_id into found_offer, found_experience
    from public.experience_offers o where o.code = lower(new.product_code);
  if found_offer is null then
    select o.id, o.experience_id into found_offer, found_experience
      from public.offer_aliases a join public.experience_offers o on o.id = a.offer_id
     where a.code = lower(new.product_code);
  end if;
  if found_offer is null then return new; end if;

  new.offer_id := found_offer;
  new.experience_id := found_experience;

  -- Услуга и посылка ждут исполнения с первой минуты; контент — нет.
  if new.fulfilment_status is null then
    select e.kind into found_kind from public.experiences e where e.id = found_experience;
    if found_kind in ('consultation', 'package', 'physical') then
      new.fulfilment_status := 'pending';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists orders_link_offer on public.orders;
create trigger orders_link_offer
  before insert or update of product_code on public.orders
  for each row execute function public.orders_link_offer();

-- Исторические заказы — тем же правилом. fulfilment_status им НЕ ставится:
-- что было исполнено полгода назад, база не знает, и 'pending' было бы ложью.
update public.orders ord
   set offer_id = o.id, experience_id = o.experience_id
  from public.experience_offers o
 where ord.offer_id is null and o.code = lower(ord.product_code);

update public.orders ord
   set offer_id = o.id, experience_id = o.experience_id
  from public.offer_aliases a join public.experience_offers o on o.id = a.offer_id
 where ord.offer_id is null and a.code = lower(ord.product_code);

commit;

-- ПРОВЕРКА:
-- select code, mode, amount, access_days, access_lifetime, invoice_heading is not null as prose from experience_offers order by code;
-- select product_code, count(*) from orders where offer_id is null group by 1 order by 2 desc;   -- что не нашло оффер
