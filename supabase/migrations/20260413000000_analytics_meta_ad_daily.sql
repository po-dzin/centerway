-- CenterWay: Meta Ads Insights ad-level daily sync storage
-- Run in Supabase SQL editor (public schema).

begin;

create table if not exists public.analytics_meta_ad_daily (
  day date not null,
  account_id text not null,
  campaign_id text not null default '',
  campaign_name text not null default '',
  adset_id text not null default '',
  adset_name text not null default '',
  ad_id text not null,
  ad_name text not null default '',
  reach bigint not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  spend numeric(14,2) not null default 0,
  currency text not null default 'UAH',
  view_content bigint not null default 0,
  initiate_checkout bigint not null default 0,
  purchase bigint not null default 0,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (day, account_id, ad_id)
);

create index if not exists idx_analytics_meta_ad_daily_day
  on public.analytics_meta_ad_daily (day desc);

create index if not exists idx_analytics_meta_ad_daily_ad
  on public.analytics_meta_ad_daily (ad_id);

create index if not exists idx_analytics_meta_ad_daily_adset
  on public.analytics_meta_ad_daily (adset_id);

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$ begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_analytics_meta_ad_daily_updated_at'
      and tgrelid = 'public.analytics_meta_ad_daily'::regclass
  ) then
    create trigger trg_analytics_meta_ad_daily_updated_at
      before update on public.analytics_meta_ad_daily
      for each row
      execute function public.update_updated_at_column();
  end if;
end $$;

alter table public.analytics_meta_ad_daily enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'analytics_meta_ad_daily'
      and policyname = 'Admins and Support can view analytics_meta_ad_daily'
  ) then
    execute $p$
      create policy "Admins and Support can view analytics_meta_ad_daily"
      on public.analytics_meta_ad_daily
      for select
      using (public.get_my_role() in ('admin', 'support'))
    $p$;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'analytics_meta_ad_daily'
      and policyname = 'Admins can manage analytics_meta_ad_daily'
  ) then
    execute $p$
      create policy "Admins can manage analytics_meta_ad_daily"
      on public.analytics_meta_ad_daily
      for all
      using (public.get_my_role() = 'admin')
    $p$;
  end if;
end $$;

commit;
