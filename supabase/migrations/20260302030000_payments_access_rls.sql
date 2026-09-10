-- CenterWay: Payments & Access RLS (Level 2-3)
-- Run in Supabase SQL editor (public schema).
-- Предполагает что orders, payments, access_tokens уже существуют.

-- ─────────────────────────────────────────
-- 1. RLS на orders
-- ─────────────────────────────────────────
alter table public.orders enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'orders' and policyname = 'Admins and Support can view orders') then
    execute $p$ create policy "Admins and Support can view orders" on public.orders for select using (public.get_my_role() in ('admin', 'support')) $p$;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'orders' and policyname = 'Admins can manage orders') then
    execute $p$ create policy "Admins can manage orders" on public.orders for all using (public.get_my_role() = 'admin') $p$;
  end if;
end $$;

-- ─────────────────────────────────────────
-- 2. RLS на payments
-- ─────────────────────────────────────────
alter table public.payments enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'payments' and policyname = 'Admins and Support can view payments') then
    execute $p$ create policy "Admins and Support can view payments" on public.payments for select using (public.get_my_role() in ('admin', 'support')) $p$;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'payments' and policyname = 'Admins can manage payments') then
    execute $p$ create policy "Admins can manage payments" on public.payments for all using (public.get_my_role() = 'admin') $p$;
  end if;
end $$;

-- ─────────────────────────────────────────
-- 3. RLS на access_tokens
-- ─────────────────────────────────────────
alter table public.access_tokens enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'access_tokens' and policyname = 'Admins and Support can view access_tokens') then
    execute $p$ create policy "Admins and Support can view access_tokens" on public.access_tokens for select using (public.get_my_role() in ('admin', 'support')) $p$;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'access_tokens' and policyname = 'Admins can manage access_tokens') then
    execute $p$ create policy "Admins can manage access_tokens" on public.access_tokens for all using (public.get_my_role() = 'admin') $p$;
  end if;
end $$;

-- ─────────────────────────────────────────
-- 4. RLS на events
-- ─────────────────────────────────────────
alter table public.events enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'events' and policyname = 'Admins and Support can view events') then
    execute $p$ create policy "Admins and Support can view events" on public.events for select using (public.get_my_role() in ('admin', 'support')) $p$;
  end if;
end $$;

-- Индексы для ускорения
create index if not exists idx_orders_status     on public.orders (status);
create index if not exists idx_orders_customer   on public.orders (customer_id);
create index if not exists idx_orders_created_at on public.orders (created_at desc);
create index if not exists idx_orders_order_ref  on public.orders (order_ref);
create index if not exists idx_payments_order_ref on public.payments (order_ref);
create index if not exists idx_access_tokens_order_ref on public.access_tokens (order_ref);
