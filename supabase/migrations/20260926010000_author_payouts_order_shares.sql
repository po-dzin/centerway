-- ДОЛИ АВТОРОВ: реквизиты выплаты и строка доли на каждый оплаченный заказ (2026-09-26).
--
-- Зачем сейчас, до выбора шлюза. Владелец хочет, чтобы автор получал свою долю
-- на свой ФОП и сам платил с неё налоги. У WayForPay транзакционного сплита нет
-- (docs/payments/wfp-split-payments-research-2026-09-17.md), у LiqPay он есть
-- (`split_rules`, до 5 получателей, каждый — свой мерчант). Какой бы шлюз ни
-- победил, база должна знать две вещи:
--
--   1. КУДА платить автору — `author_payout_accounts`, одна строка на автора.
--      `receiver_ref` — идентификатор автора У ШЛЮЗА (для LiqPay — public_key
--      его мерчанта); пока шлюз не умеет делить, поле пустое, и выплата идёт
--      вручную по `iban`.
--   2. СКОЛЬКО ему причитается с каждого заказа — `order_shares`. Строку пишет
--      БАЗА, триггером на `orders.status → paid`, потому что оплаченным заказ
--      делают пять мест (вебхук, ручная продажа, сверка, бэкфилл, скрипты), и
--      одно правило здесь надёжнее пяти правок там — тот же довод, что у
--      `orders_link_offer`.
--
-- Процент: `experience_offers.share_pct` оффера, иначе `default_share_pct`
-- автора, иначе доли нет (вещь платформы — строка не пишется).
--
-- Статусы доли:
--   accrued          начислена, платформа должна автору (гибрид: деньги пришли
--                    платформе, выплата вручную по реестру);
--   split_at_source  шлюз разделил платёж сам, платформа денег автора не держала;
--   paid_out         выплачена вручную;
--   reversed         заказ возвращён ДО выплаты — долга нет;
--   clawback         заказ возвращён ПОСЛЕ выплаты — автор должен вернуть.
--
-- Откат:
--   drop trigger if exists orders_accrue_shares on public.orders;
--   drop function if exists public.orders_accrue_shares();
--   drop table if exists public.order_shares, public.author_payout_accounts;
--   alter table public.orders drop column if exists split_at_source;

begin;

create table if not exists public.author_payout_accounts (
  author_id          uuid primary key references public.lms_authors (id) on delete cascade,
  legal_name         text        null,
  tax_id             text        null,
  iban               text        null,
  gateway            text        null,
  receiver_ref       text        null,
  default_share_pct  numeric(5,2) null,
  active             boolean     not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint author_payout_share_range check (default_share_pct is null or (default_share_pct >= 0 and default_share_pct <= 100)),
  constraint author_payout_gateway_known check (gateway is null or gateway in ('wfp', 'liqpay', 'monobank')),
  constraint author_payout_iban_shape check (iban is null or iban ~ '^UA[0-9]{27}$')
);

comment on table public.author_payout_accounts is
  'Куда платить автору его долю: реквизиты ФОП и идентификатор у шлюза. Только владелец.';
comment on column public.author_payout_accounts.receiver_ref is
  'Идентификатор автора у шлюза со сплитом (LiqPay: public_key мерчанта автора). NULL — выплата вручную по iban.';
comment on column public.author_payout_accounts.default_share_pct is
  'Доля автора, %, когда у оффера своя не задана. NULL — доли нет.';

alter table public.orders
  add column if not exists split_at_source boolean not null default false;

comment on column public.orders.split_at_source is
  'Шлюз разделил этот платёж сам (split_rules): доля автора ушла ему напрямую, платформа её не держала.';

create table if not exists public.order_shares (
  id             uuid primary key default gen_random_uuid(),
  order_ref      text        not null,
  author_id      uuid        not null references public.lms_authors (id),
  offer_id       uuid        null references public.experience_offers (id) on delete set null,
  share_pct      numeric(5,2) not null,
  base_amount    numeric(12,2) not null,
  amount         numeric(12,2) not null,
  currency       text        not null,
  status         text        not null,
  paid_out_at    timestamptz null,
  payout_note    text        null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint order_shares_status_known check (status in ('accrued', 'split_at_source', 'paid_out', 'reversed', 'clawback')),
  constraint order_shares_pct_range check (share_pct > 0 and share_pct <= 100),
  constraint order_shares_one_per_author unique (order_ref, author_id)
);

comment on table public.order_shares is
  'Доля автора с оплаченного заказа. Пишет триггер orders_accrue_shares; выплату отмечает владелец.';

create index if not exists idx_order_shares_author_status on public.order_shares (author_id, status);

alter table public.author_payout_accounts enable row level security;
alter table public.order_shares enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['author_payout_accounts', 'order_shares'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = t || '_admin_all') then
      execute format(
        'create policy %I on public.%I for all using (public.get_my_role() = ''admin'') with check (public.get_my_role() = ''admin'')',
        t || '_admin_all', t
      );
    end if;
  end loop;
end $$;

grant all on public.author_payout_accounts, public.order_shares to service_role;

create or replace function public.orders_accrue_shares()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  found_author uuid;
  found_pct numeric;
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

  -- Доля оффера первой, авторская по умолчанию — второй. Реквизитов может ещё
  -- не быть: долг перед автором от этого не исчезает, он ждёт реквизитов.
  select o.share_pct into found_pct from public.experience_offers o where o.id = new.offer_id;
  if found_pct is null then
    select p.default_share_pct into found_pct
      from public.author_payout_accounts p
     where p.author_id = found_author and p.active;
  end if;
  if found_pct is null or found_pct <= 0 then return new; end if;

  base := new.amount;
  insert into public.order_shares (order_ref, author_id, offer_id, share_pct, base_amount, amount, currency, status)
  values (
    new.order_ref, found_author, new.offer_id, found_pct, base,
    round(base * found_pct / 100, 2), coalesce(new.currency, 'UAH'),
    case when new.split_at_source then 'split_at_source' else 'accrued' end
  )
  on conflict (order_ref, author_id) do nothing;
  return new;
end $$;

drop trigger if exists orders_accrue_shares on public.orders;
create trigger orders_accrue_shares
  after insert or update of status on public.orders
  for each row execute function public.orders_accrue_shares();

commit;
