-- CenterWay: Pixel Stats daily storage
-- Run in Supabase SQL editor (public schema).

begin;

create table if not exists public.analytics_pixel_daily (
  day date not null,
  pixel_id text not null,
  view_content bigint not null default 0,
  initiate_checkout bigint not null default 0,
  purchase bigint not null default 0,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (day, pixel_id)
);

create index if not exists idx_analytics_pixel_daily_day
  on public.analytics_pixel_daily (day desc);

create index if not exists idx_analytics_pixel_daily_pixel
  on public.analytics_pixel_daily (pixel_id);

alter table public.analytics_pixel_daily enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'analytics_pixel_daily'
      and policyname = 'Admins and Support can view analytics_pixel_daily'
  ) then
    execute $p$
      create policy "Admins and Support can view analytics_pixel_daily"
      on public.analytics_pixel_daily
      for select
      using (public.get_my_role() in ('admin', 'support'))
    $p$;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'analytics_pixel_daily'
      and policyname = 'Admins can manage analytics_pixel_daily'
  ) then
    execute $p$
      create policy "Admins can manage analytics_pixel_daily"
      on public.analytics_pixel_daily
      for all
      using (public.get_my_role() = 'admin')
    $p$;
  end if;
end $$;

commit;
