-- CenterWay: FINAL Analytics + Tracking Fields
-- Run in Supabase SQL editor (public schema).
-- Idempotent and safe for reruns.

begin;

-- ---------------------------------------------------------
-- 1) Tracking fields for attribution/CAPI
-- ---------------------------------------------------------
alter table public.leads
add column if not exists fbp text,
add column if not exists fbclid text,
add column if not exists campaign text,
add column if not exists client_ip text,
add column if not exists client_ua text,
add column if not exists page_url text;

alter table public.orders
add column if not exists fbp text,
add column if not exists fbclid text,
add column if not exists campaign text,
add column if not exists client_ip text,
add column if not exists client_ua text,
add column if not exists page_url text;

-- ---------------------------------------------------------
-- 2) MV: Funnel Daily
-- ---------------------------------------------------------
drop materialized view if exists public.mv_funnel_daily;
create materialized view public.mv_funnel_daily as
with date_series as (
  select generate_series(
    (select coalesce(min(created_at), now() - interval '30 days') from public.leads)::date,
    now()::date,
    interval '1 day'
  )::date as report_date
),
leads_daily as (
  select
    created_at::date as record_date,
    count(distinct id) as total_leads,
    count(distinct phone) as unique_phones,
    count(distinct email) as unique_emails
  from public.leads
  group by created_at::date
),
orders_daily as (
  select
    created_at::date as record_date,
    count(distinct id) as total_orders,
    count(distinct id) filter (where status in ('paid', 'completed')) as paid_orders,
    sum(coalesce(amount, 0)) filter (where status in ('paid', 'completed')) as revenue
  from public.orders
  group by created_at::date
)
select
  ds.report_date as date,
  coalesce(l.total_leads, 0) as leads_count,
  coalesce(l.unique_phones, 0) as unique_lead_phones,
  coalesce(o.total_orders, 0) as orders_created,
  coalesce(o.paid_orders, 0) as orders_paid,
  coalesce(o.revenue, 0) as total_revenue,
  case
    when coalesce(l.total_leads, 0) > 0
      then round((coalesce(o.paid_orders, 0)::numeric / l.total_leads) * 100, 2)
    else 0
  end as conversion_rate_percent
from date_series ds
left join leads_daily l on l.record_date = ds.report_date
left join orders_daily o on o.record_date = ds.report_date
order by ds.report_date desc;

create unique index if not exists ux_mv_funnel_daily_date
  on public.mv_funnel_daily (date);

-- ---------------------------------------------------------
-- 3) MV: Revenue by Campaign
-- ---------------------------------------------------------
drop materialized view if exists public.mv_revenue_by_campaign;
create materialized view public.mv_revenue_by_campaign as
select
  coalesce(campaign, 'organic') as source_campaign,
  count(id) as total_orders,
  count(id) filter (where status in ('paid', 'completed')) as paid_orders,
  sum(coalesce(amount, 0)) filter (where status in ('paid', 'completed')) as total_revenue
from public.orders
group by 1
order by 4 desc nulls last;

create unique index if not exists ux_mv_revenue_by_campaign_source
  on public.mv_revenue_by_campaign (source_campaign);

-- ---------------------------------------------------------
-- 4) MV: Quality Gaps (Step 6 DoD report #3)
-- ---------------------------------------------------------
drop materialized view if exists public.mv_quality_gaps;
create materialized view public.mv_quality_gaps as
select
  now()::date as snapshot_date,
  count(*) filter (where o.status in ('paid', 'completed') and (o.fbclid is null or o.fbclid = '')) as paid_missing_fbclid,
  count(*) filter (where o.status in ('paid', 'completed') and (o.fbp is null or o.fbp = '')) as paid_missing_fbp,
  count(*) filter (where o.status in ('paid', 'completed') and (o.page_url is null or o.page_url = '')) as paid_missing_page_url,
  count(*) filter (where o.status in ('paid', 'completed') and (o.client_ip is null or o.client_ip = '')) as paid_missing_client_ip,
  count(*) filter (where o.status in ('paid', 'completed') and (o.client_ua is null or o.client_ua = '')) as paid_missing_client_ua
from public.orders o;

create unique index if not exists ux_mv_quality_gaps_snapshot_date
  on public.mv_quality_gaps (snapshot_date);

-- ---------------------------------------------------------
-- 5) Refresh function (for cron/manual refresh)
-- ---------------------------------------------------------
create or replace function public.refresh_analytics_views()
returns void
language plpgsql
security definer
as $$
begin
  refresh materialized view concurrently public.mv_funnel_daily;
  refresh materialized view concurrently public.mv_revenue_by_campaign;
  refresh materialized view concurrently public.mv_quality_gaps;
end;
$$;

commit;
