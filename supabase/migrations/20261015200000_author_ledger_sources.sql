-- ОБЛІК АВТОРА: посилання автора, джерело частки и её снимок на заказе (2026-10-14).
--
-- Зачем. Условия для авторов (G, 14.10): с продаж из каналов автора ему 90 %,
-- с продаж, которые привела платформа, 50 %. Где прошла граница, решает ссылка:
-- автор создаёт себе метки `?ref=` под каждый пост, сторис, эфир, и заказ,
-- пришедший по его метке, — его. Механизм `?ref` уже есть (first touch, 90 дней,
-- `orders.ref`, `src/lib/referral/ref.ts`); не было только знания, ЧЬЯ метка.
--
--   1. `author_links` — метки автора. Одна метка — один владелец.
--   2. `author_payout_accounts.own_share_pct` — доля автора с его каналов.
--      Прежние `experience_offers.share_pct` / `default_share_pct` остаются
--      долей с трафика платформы: смысл существующих строк не меняется.
--   3. `orders.author_share_pct` / `author_share_source` — снимок доли в момент
--      счёта (бэклог 08.10): при сплите LiqPay сумма автора уходит в счёт ДО
--      оплаты, и строка реестра должна совпасть с тем, что ушло, даже если долю
--      в оффере успели поменять. Пишет `paymentStart` через `invoiceSplits.ts`.
--   4. `order_shares.source` / `ref` — откуда пришла продажа, для отчёта автору.
--
-- Правило доли в триггере, по порядку: снимок на заказе; иначе — метка заказа
-- принадлежит автору этого опыта → own_share_pct (если не задан — доля
-- платформы); иначе — доля платформы, как было.
--
-- Откат:
--   drop table if exists public.author_links;
--   alter table public.author_payout_accounts drop column if exists own_share_pct;
--   alter table public.orders drop column if exists author_share_pct, drop column if exists author_share_source;
--   alter table public.order_shares drop column if exists source, drop column if exists ref;
--   и прежнее тело orders_accrue_shares из 20260926010000.

begin;

create table if not exists public.author_links (
  tag          text        primary key,
  author_id    uuid        not null references public.lms_authors (id) on delete cascade,
  label        text        not null,
  channel      text        null,
  target_path  text        not null default '/',
  created_at   timestamptz not null default now(),
  archived_at  timestamptz null,
  constraint author_links_tag_shape check (tag ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  constraint author_links_label_length check (char_length(btrim(label)) between 1 and 120),
  constraint author_links_target_path check (target_path ~ '^/[^\s]{0,200}$')
);

comment on table public.author_links is
  'Метки ?ref= автора: под пост, сторис, эфир. Заказ по такой метке — продажа из каналов автора.';

create index if not exists idx_author_links_author on public.author_links (author_id, created_at desc);

alter table public.author_links enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'author_links' and policyname = 'author_links_admin_all') then
    create policy author_links_admin_all on public.author_links
      for all using (public.get_my_role() = 'admin') with check (public.get_my_role() = 'admin');
  end if;
end $$;

grant all on public.author_links to service_role;

alter table public.author_payout_accounts
  add column if not exists own_share_pct numeric(5,2) null;

alter table public.author_payout_accounts
  drop constraint if exists author_payout_own_share_range;
alter table public.author_payout_accounts
  add constraint author_payout_own_share_range
  check (own_share_pct is null or (own_share_pct >= 0 and own_share_pct <= 100));

comment on column public.author_payout_accounts.own_share_pct is
  'Доля автора, %, с продаж по его собственным меткам (author_links). NULL — как с трафика платформы.';

alter table public.orders
  add column if not exists author_share_pct numeric(5,2) null,
  add column if not exists author_share_source text null;

alter table public.orders drop constraint if exists orders_author_share_source_known;
alter table public.orders
  add constraint orders_author_share_source_known
  check (author_share_source is null or author_share_source in ('author', 'platform'));

comment on column public.orders.author_share_pct is
  'Снимок доли автора в момент счёта. Пишется, когда доля известна до оплаты (сплит); триггер берёт его первым.';

alter table public.order_shares
  add column if not exists source text not null default 'platform',
  add column if not exists ref text null;

alter table public.order_shares drop constraint if exists order_shares_source_known;
alter table public.order_shares
  add constraint order_shares_source_known check (source in ('author', 'platform'));

comment on column public.order_shares.source is
  'author — покупатель пришёл по метке автора; platform — всё остальное.';

create or replace function public.orders_accrue_shares()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  found_author uuid;
  found_pct numeric;
  platform_pct numeric;
  own_pct numeric;
  found_source text;
  base numeric;
begin
  -- Возврат: невыплаченная доля гаснет, выплаченная становится долгом автора.
  if new.status = 'refunded' and old.status is distinct from 'refunded' then
    update public.order_shares
       set status = case when status = 'paid_out' then 'clawback' else 'reversed' end,
           updated_at = now()
     where order_ref = new.order_ref and status in ('accrued', 'split_at_source', 'paid_out');
    return new;
  end if;

  if new.status is distinct from 'paid' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'paid' then return new; end if;
  if new.experience_id is null or new.amount is null or new.amount <= 0 then return new; end if;

  select e.author_profile_id into found_author from public.experiences e where e.id = new.experience_id;
  if found_author is null then return new; end if;

  if new.author_share_pct is not null then
    -- Снимок из счёта: ровно то, что ушло автору при сплите.
    found_pct := new.author_share_pct;
    found_source := coalesce(new.author_share_source, 'platform');
  else
    -- Два отдельных чтения: SELECT INTO без строки обнуляет цели, и доля
    -- оффера не должна пропасть оттого, что реквизитов автора ещё нет.
    select o.share_pct into platform_pct from public.experience_offers o where o.id = new.offer_id;
    select p.default_share_pct, p.own_share_pct into found_pct, own_pct
      from public.author_payout_accounts p
     where p.author_id = found_author and p.active;
    platform_pct := coalesce(platform_pct, found_pct);

    if new.ref is not null and exists (
      select 1 from public.author_links l where l.tag = new.ref and l.author_id = found_author
    ) then
      found_source := 'author';
      found_pct := coalesce(own_pct, platform_pct);
    else
      found_source := 'platform';
      found_pct := platform_pct;
    end if;
  end if;

  if found_pct is null or found_pct <= 0 then return new; end if;

  base := new.amount;
  insert into public.order_shares (order_ref, author_id, offer_id, share_pct, base_amount, amount, currency, status, source, ref)
  values (
    new.order_ref, found_author, new.offer_id, found_pct, base,
    round(base * found_pct / 100, 2), coalesce(new.currency, 'UAH'),
    case when new.split_at_source then 'split_at_source' else 'accrued' end,
    found_source, new.ref
  )
  on conflict (order_ref, author_id) do nothing;
  return new;
end $$;

commit;
