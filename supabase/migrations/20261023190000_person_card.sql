-- person_card: одна карточка человека поверх customers
-- 23.10.2026
--
-- ЗАЧЕМ.
--   G 23.10 выбрал: единая карточка человека — это `customers`, а не новая
--   таблица. Все входы (оплата, форма, тест, бот, автоответ Instagram, импорт
--   старых баз) пишут в одну строку, рассылки читают из неё же. Схема пути:
--   артефакт «Путь человека CenterWay».
--
--   1. Телефон для склейки. `phone` хранится как его ввели («067 123 45 67»,
--      «+380671234567»), поэтому один человек мог жить двумя строками.
--      `phone_e164` — тот же номер в одном виде (+380…), его считает база,
--      и по нему склеиваем (решение G 23.10: склейка по телефону автоматом).
--      Правило нормализации повторяет `normalizePhoneE164` в
--      src/lib/platform/customerIdentity.ts — менять оба вместе.
--   2. Instagram. Автоответ знает Instagram-id и ник человека, но писал их
--      только в журнал правила. Теперь они есть в карточке.
--   3. Первое касание. Откуда человек пришёл впервые: канал, способ,
--      кампания, кто привёл. Пишется один раз и больше не меняется.
--   4. История тегов. `customers.tags` остаётся быстрым списком для фильтров
--      и аудиторий рассылок; `customer_tags` помнит, откуда и когда пришёл
--      каждый тег. Триггер дописывает в историю тег, который кто-то положил
--      прямо в `tags` (бот, тест), с источником 'app'.
--   5. Подписка ↔ карточка. Импорт адресов не заполнял `customer_id`. Теперь
--      триггер находит карточку по адресу при вставке, а старые строки
--      связываются один раз ниже.
--
-- Теги — латиницей (решение G 23.10): строчные буквы, цифры, «-» и «_».
-- Форму проверяет TypeScript (src/lib/platform/customerTags.ts); в базе
-- ограничения нет, чтобы старые теги не уронили миграцию.
--
-- ОТКАТ:
--   drop trigger if exists trg_messaging_subscriptions_link_customer on public.messaging_subscriptions;
--   drop function if exists public.cw_link_subscription_customer();
--   drop trigger if exists trg_customers_tag_history on public.customers;
--   drop function if exists public.cw_customer_tag_history();
--   drop table if exists public.customer_tags;
--   drop index if exists public.customers_ig_user_id_key;
--   drop index if exists public.idx_customers_phone_e164;
--   alter table public.customers drop column if exists phone_e164,
--     drop column if exists ig_user_id, drop column if exists ig_username,
--     drop column if exists first_touch;
--   drop function if exists public.cw_normalize_phone(text);

begin;

-- ─── 1. Телефон ──────────────────────────────────────────────────────────────

create or replace function public.cw_normalize_phone(raw text)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when d is null or d = '' then null
    when length(d) = 10 and left(d, 1) = '0' then '+38' || d
    when length(d) = 9 then '+380' || d
    when length(d) = 11 and left(d, 2) = '80' then '+3' || d
    when length(d) between 10 and 15 then '+' || d
    else null
  end
  from (select regexp_replace(coalesce(raw, ''), '\D', '', 'g') as d) as digits
$$;

comment on function public.cw_normalize_phone(text) is
  'Телефон в одном виде (+380…) для склейки. Тот же алгоритм — normalizePhoneE164 в customerIdentity.ts.';

alter table public.customers
  add column if not exists phone_e164 text generated always as (public.cw_normalize_phone(phone)) stored;

create index if not exists idx_customers_phone_e164 on public.customers (phone_e164);

-- ─── 2–3. Instagram и первое касание ─────────────────────────────────────────

alter table public.customers
  add column if not exists ig_user_id text null,
  add column if not exists ig_username text null,
  add column if not exists first_touch jsonb null;

create unique index if not exists customers_ig_user_id_key
  on public.customers (ig_user_id) where ig_user_id is not null;

comment on column public.customers.ig_user_id is 'Instagram-scoped id (IGSID) из автоответа.';
comment on column public.customers.ig_username is 'Ник в Instagram, как его прислал вебхук.';
comment on column public.customers.first_touch is
  'Откуда человек пришёл впервые: {channel, medium, campaign, ref, at}. Пишется один раз.';

-- ─── 4. История тегов ────────────────────────────────────────────────────────

create table if not exists public.customer_tags (
  customer_id uuid not null references public.customers (id) on delete cascade,
  tag text not null,
  -- Откуда тег: 'autoreply', 'import:smartsender', 'test', 'bot', 'admin', 'app', 'legacy'.
  source text not null default 'app',
  created_by uuid null,
  created_at timestamptz not null default now(),
  primary key (customer_id, tag)
);

create index if not exists customer_tags_tag_idx on public.customer_tags (tag);

alter table public.customer_tags enable row level security;
revoke all on public.customer_tags from anon, authenticated;

insert into public.customer_tags (customer_id, tag, source, created_at)
select c.id, t.tag, 'legacy', coalesce(c.created_at, now())
from public.customers c
cross join lateral unnest(coalesce(c.tags, '{}'::text[])) as t(tag)
where btrim(t.tag) <> ''
on conflict do nothing;

create or replace function public.cw_customer_tag_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.customer_tags (customer_id, tag, source)
  select new.id, t.tag, 'app'
  from unnest(coalesce(new.tags, '{}'::text[])) as t(tag)
  where btrim(t.tag) <> ''
  on conflict do nothing;
  return new;
end;
$$;

revoke all on function public.cw_customer_tag_history() from public, anon, authenticated;

drop trigger if exists trg_customers_tag_history on public.customers;
create trigger trg_customers_tag_history
  after insert or update of tags on public.customers
  for each row execute function public.cw_customer_tag_history();

-- ─── 5. Подписка ↔ карточка ──────────────────────────────────────────────────

create or replace function public.cw_link_subscription_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_id is null then
    if new.channel = 'email' then
      select c.id into new.customer_id
      from public.customers c
      where lower(btrim(c.email)) = new.address
      order by c.created_at asc
      limit 1;
    elsif new.channel = 'telegram' then
      select c.id into new.customer_id
      from public.customers c
      where c.tg_id = new.address
      order by c.created_at asc
      limit 1;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.cw_link_subscription_customer() from public, anon, authenticated;

drop trigger if exists trg_messaging_subscriptions_link_customer on public.messaging_subscriptions;
create trigger trg_messaging_subscriptions_link_customer
  before insert or update of address, customer_id on public.messaging_subscriptions
  for each row execute function public.cw_link_subscription_customer();

update public.messaging_subscriptions s
set customer_id = c.id
from (
  select distinct on (lower(btrim(email))) id, lower(btrim(email)) as email
  from public.customers
  where email is not null
  order by lower(btrim(email)), created_at asc
) c
where s.customer_id is null and s.channel = 'email' and s.address = c.email;

update public.messaging_subscriptions s
set customer_id = c.id
from (
  select distinct on (tg_id) id, tg_id
  from public.customers
  where tg_id is not null
  order by tg_id, created_at asc
) c
where s.customer_id is null and s.channel = 'telegram' and s.address = c.tg_id;

commit;
