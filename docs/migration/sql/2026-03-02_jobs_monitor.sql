-- CenterWay: Jobs Monitor Table
-- Run in Supabase SQL editor (public schema).

-- ─────────────────────────────────────────
-- 1. Create table
-- ─────────────────────────────────────────
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null,               -- 'email:send', 'tg:provision', 'webhook:handle'
  payload jsonb default '{}'::jsonb,-- Data needed to run the job
  status text not null default 'pending', -- 'pending', 'running', 'success', 'failed'
  error_text text,                  -- Dump of the error if failed
  attempts integer default 0,       -- How many times it was tried
  run_at timestamp with time zone default now(), -- When to try running it
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Trigger to update updated_at
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'handle_updated_at' and tgrelid = 'public.jobs'::regclass) then
    create trigger handle_updated_at before update on public.jobs
      for each row execute function public.update_updated_at_column();
  end if;
end $$;

-- ─────────────────────────────────────────
-- 2. Indexes
-- ─────────────────────────────────────────
create index if not exists idx_jobs_status on public.jobs (status);
create index if not exists idx_jobs_run_at on public.jobs (run_at);
create index if not exists idx_jobs_type on public.jobs (type);

-- ─────────────────────────────────────────
-- 3. RLS
-- ─────────────────────────────────────────
alter table public.jobs enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'jobs' and policyname = 'Admins and Support can view jobs') then
    execute $p$ create policy "Admins and Support can view jobs" on public.jobs for select using (public.get_my_role() in ('admin', 'support')) $p$;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'jobs' and policyname = 'Admins can manage jobs') then
    execute $p$ create policy "Admins can manage jobs" on public.jobs for all using (public.get_my_role() = 'admin') $p$;
  end if;
end $$;
