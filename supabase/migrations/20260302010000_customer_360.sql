-- CenterWay: Customer 360 — Единый профиль клиента
-- Возвращаемся к плоской и прозрачной структуре. Всё хранится в customers.

-- 1. Расширяем существующую customers
alter table public.customers
  add column if not exists display_name text,
  add column if not exists avatar_url   text,
  add column if not exists tags         text[] not null default '{}',
  add column if not exists notes        text,
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists tg_id        text,
  add column if not exists google_id    text,
  add column if not exists updated_at   timestamptz not null default now();

-- 2. Индексы для быстрого поиска (email и phone уже должны быть)
create index if not exists idx_customers_email            on public.customers (email);
create index if not exists idx_customers_phone            on public.customers (phone);
create index if not exists idx_customers_auth_user_id     on public.customers (auth_user_id);
create index if not exists idx_customers_tg_id            on public.customers (tg_id);
create index if not exists idx_customers_created_at       on public.customers (created_at desc);

-- 3. Auto-update updated_at при изменении customers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- 4. Enable RLS на customers (если не было)
alter table public.customers enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'customers' and policyname = 'Admins and Support can view customers'
  ) then
    execute $p$
      create policy "Admins and Support can view customers"
        on public.customers for select
        using (public.get_my_role() in ('admin', 'support'))
    $p$;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'customers' and policyname = 'Admins can manage customers'
  ) then
    execute $p$
      create policy "Admins can manage customers"
        on public.customers for all
        using (public.get_my_role() = 'admin')
    $p$;
  end if;
end $$;
