-- CenterWay: create dedicated leads table for pre-checkout captures.
-- Run in Supabase SQL editor (public schema).

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  order_ref text not null unique,
  product_code text not null,
  source text not null,
  name text null,
  email text null,
  phone text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_product_code_idx on public.leads (product_code);
create index if not exists leads_email_idx on public.leads (email);
create index if not exists leads_phone_idx on public.leads (phone);
