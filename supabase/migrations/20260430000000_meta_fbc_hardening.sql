-- CenterWay: Meta click identity hardening
-- Purpose:
--   1) Persist raw/stable fbc alongside existing tracking fields.
--   2) Make fbc observable in quality views.
-- Notes:
--   Runtime is backward-compatible and can recover fbc from checkout_started payloads,
--   but this schema hardening makes Purchase-quality forensics easier and more durable.

begin;

alter table public.leads
add column if not exists fbc text;

alter table public.orders
add column if not exists fbc text;

drop materialized view if exists public.mv_quality_gaps;
create materialized view public.mv_quality_gaps as
select
  now()::date as snapshot_date,
  count(*) filter (where o.status in ('paid', 'completed') and (o.fbc is null or o.fbc = '')) as paid_missing_fbc,
  count(*) filter (where o.status in ('paid', 'completed') and (o.fbclid is null or o.fbclid = '')) as paid_missing_fbclid,
  count(*) filter (where o.status in ('paid', 'completed') and (o.fbp is null or o.fbp = '')) as paid_missing_fbp,
  count(*) filter (where o.status in ('paid', 'completed') and (o.page_url is null or o.page_url = '')) as paid_missing_page_url,
  count(*) filter (where o.status in ('paid', 'completed') and (o.client_ip is null or o.client_ip = '')) as paid_missing_client_ip,
  count(*) filter (where o.status in ('paid', 'completed') and (o.client_ua is null or o.client_ua = '')) as paid_missing_client_ua
from public.orders o;

create unique index if not exists ux_mv_quality_gaps_snapshot_date
  on public.mv_quality_gaps (snapshot_date);

commit;
