-- CenterWay: Foundation & Security (Level 0) for Admin Panel
-- Run in Supabase SQL editor (public schema).

-- 1. Roles table
create table if not exists public.user_roles (
  user_id uuid references auth.users not null primary key,
  role text not null check (role in ('admin', 'support', 'user')) default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Audit log table
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.user_roles enable row level security;
alter table public.audit_log enable row level security;

-- 3. SECURITY DEFINER function to read caller's role without triggering RLS
--    (prevents infinite recursion in policies that reference user_roles)
create or replace function public.get_my_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.user_roles where user_id = auth.uid() limit 1;
$$;

-- Policies for user_roles
create policy "Users can view their own role" on public.user_roles
for select using (auth.uid() = user_id);

-- Admins can manage all roles (uses get_my_role() to avoid recursion)
create policy "Admins can manage all roles" on public.user_roles
for all using (public.get_my_role() = 'admin');

-- Policies for audit_log
create policy "Admins and Support can view audit log" on public.audit_log
for select using (
  public.get_my_role() in ('admin', 'support')
);

create policy "Admins and Support can insert audit log" on public.audit_log
for insert with check (
  public.get_my_role() in ('admin', 'support')
);

-- Indices for performance
create index if not exists idx_audit_log_actor_id on public.audit_log (actor_id);
create index if not exists idx_audit_log_entity on public.audit_log (entity_type, entity_id);
create index if not exists idx_audit_log_created_at on public.audit_log (created_at desc);
