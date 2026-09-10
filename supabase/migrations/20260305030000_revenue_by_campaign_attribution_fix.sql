-- CenterWay: Fix campaign attribution buckets in mv_revenue_by_campaign
-- Run after 2026-03-02_analytics_views.sql

begin;

drop materialized view if exists public.mv_revenue_by_campaign;

create materialized view public.mv_revenue_by_campaign as
select
  case
    when nullif(trim(campaign), '') is not null then trim(campaign)
    when nullif(trim(fbclid), '') is not null or nullif(trim(fbp), '') is not null then 'meta (no utm_campaign)'
    else 'organic/direct'
  end as source_campaign,
  count(id) as total_orders,
  count(id) filter (where status in ('paid', 'completed')) as paid_orders,
  sum(coalesce(amount, 0)) filter (where status in ('paid', 'completed')) as total_revenue
from public.orders
group by 1
order by 4 desc nulls last;

create unique index if not exists ux_mv_revenue_by_campaign_source
  on public.mv_revenue_by_campaign (source_campaign);

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
