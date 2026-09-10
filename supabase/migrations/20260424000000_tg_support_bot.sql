-- CenterWay: Telegram support bot sessions and lookup indexes.

create table if not exists public.support_bot_sessions (
  telegram_user_id text primary key,
  telegram_username text,
  selected_product text check (selected_product in ('short', 'irem')),
  state text not null default 'idle',
  contact text,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_support_bot_sessions_updated_at on public.support_bot_sessions;
create trigger trg_support_bot_sessions_updated_at
  before update on public.support_bot_sessions
  for each row execute function public.set_updated_at();

alter table public.support_bot_sessions enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'support_bot_sessions'
      and policyname = 'Admins and Support can view support bot sessions'
  ) then
    execute $p$
      create policy "Admins and Support can view support bot sessions"
        on public.support_bot_sessions for select
        using (public.get_my_role() in ('admin', 'support'))
    $p$;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'support_bot_sessions'
      and policyname = 'Admins can manage support bot sessions'
  ) then
    execute $p$
      create policy "Admins can manage support bot sessions"
        on public.support_bot_sessions for all
        using (public.get_my_role() = 'admin')
    $p$;
  end if;
end $$;

create index if not exists idx_customers_email on public.customers (email);
create index if not exists idx_customers_phone on public.customers (phone);
create index if not exists idx_orders_customer_product_status
  on public.orders (customer_id, product_code, status);
create index if not exists idx_support_bot_sessions_updated_at
  on public.support_bot_sessions (updated_at desc);
