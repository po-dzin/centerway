-- CenterWay: floor local view_content to at least orders-created count by day
-- Purpose: reduce funnel mismatch when ViewContent was connected later than checkout/order creation.
-- Safe for reruns (inserts only missing synthetic rows).

begin;

with orders_daily as (
  select
    (o.created_at at time zone 'UTC')::date as day,
    count(*)::int as orders_created
  from public.orders o
  where o.created_at is not null
  group by 1
),
view_daily as (
  select
    (e.created_at at time zone 'UTC')::date as day,
    count(*)::int as view_content_count
  from public.events e
  where e.type = 'view_content'
    and e.created_at is not null
  group by 1
),
missing_daily as (
  select
    od.day,
    greatest(od.orders_created - coalesce(vd.view_content_count, 0), 0) as missing_count
  from orders_daily od
  left join view_daily vd on vd.day = od.day
  where greatest(od.orders_created - coalesce(vd.view_content_count, 0), 0) > 0
),
synthetic_rows as (
  select
    md.day,
    gs.idx,
    format('backfill_view_floor_%s_%s', to_char(md.day, 'YYYYMMDD'), gs.idx) as synthetic_event_id
  from missing_daily md
  join lateral generate_series(1, md.missing_count) as gs(idx) on true
)
insert into public.events (type, order_ref, payload, created_at)
select
  'view_content' as type,
  null as order_ref,
  jsonb_build_object(
    'event_name', 'ViewContent',
    'event_id', sr.synthetic_event_id,
    'source', 'backfill_view_floor_to_checkout',
    'synthetic', true
  ) as payload,
  (sr.day::timestamp + make_interval(secs => least(sr.idx, 86399))) at time zone 'UTC' as created_at
from synthetic_rows sr
where not exists (
  select 1
  from public.events e
  where e.type = 'view_content'
    and coalesce(e.payload->>'event_id', '') = sr.synthetic_event_id
);

commit;
