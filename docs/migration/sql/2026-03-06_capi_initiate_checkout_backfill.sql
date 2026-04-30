-- CenterWay: SAFE backfill for missing CAPI InitiateCheckout jobs
-- Goal:
--   Queue InitiateCheckout for legacy orders that never got a meta:capi job.
-- Safety:
--   1) Idempotent: skips orders that already have InitiateCheckout job by order_ref.
--   2) Preserves historical attribution windows: created_at is set to order.created_at.
--   3) Uses best available tracking fields from orders and checkout_started events.

begin;

with checkout_events_latest as (
  select distinct on (e.order_ref)
    e.order_ref,
    nullif(trim(e.payload ->> 'event_id'), '') as event_id,
    nullif(trim(e.payload ->> 'fbp'), '') as fbp,
    nullif(trim(e.payload ->> 'fbc'), '') as fbc,
    nullif(trim(e.payload ->> 'fbclid'), '') as fbclid,
    nullif(trim(e.payload ->> 'page_url'), '') as page_url,
    nullif(trim(e.payload ->> 'client_ip'), '') as client_ip,
    nullif(trim(e.payload ->> 'client_ua'), '') as client_ua
  from public.events e
  where e.type = 'checkout_started'
    and e.order_ref is not null
  order by e.order_ref, e.created_at desc
),
candidate_orders as (
  select
    o.order_ref,
    o.product_code,
    coalesce(o.amount, 0) as amount,
    coalesce(nullif(trim(o.currency), ''), 'UAH') as currency,
    coalesce(o.created_at, now()) as order_created_at,
    coalesce(nullif(trim(o.fbp), ''), ce.fbp) as fbp,
    ce.fbc as fbc,
    coalesce(nullif(trim(o.fbclid), ''), ce.fbclid) as fbclid,
    coalesce(nullif(trim(o.client_ip), ''), ce.client_ip) as client_ip,
    coalesce(nullif(trim(o.client_ua), ''), ce.client_ua) as client_ua,
    coalesce(nullif(trim(o.page_url), ''), ce.page_url) as page_url,
    coalesce(ce.event_id, 'checkout_' || o.order_ref) as event_id
  from public.orders o
  left join checkout_events_latest ce on ce.order_ref = o.order_ref
  where o.order_ref is not null
),
orders_missing_capi as (
  select c.*
  from candidate_orders c
  where not exists (
    select 1
    from public.jobs j
    where j.type = 'meta:capi'
      and j.payload ->> 'event_name' = 'InitiateCheckout'
      and j.payload ->> 'order_ref' = c.order_ref
  )
)
insert into public.jobs (
  type,
  payload,
  status,
  attempts,
  run_at,
  created_at,
  updated_at
)
select
  'meta:capi' as type,
  jsonb_strip_nulls(
    jsonb_build_object(
      'event_name', 'InitiateCheckout',
      'event_id', m.event_id,
      'event_time', extract(epoch from m.order_created_at)::bigint,
      'value', m.amount,
      'currency', m.currency,
      'order_ref', m.order_ref,
      'fbp', m.fbp,
      'fbc', m.fbc,
      'fbclid', m.fbclid,
      'ip_address', m.client_ip,
      'user_agent', m.client_ua,
      'event_source_url', m.page_url,
      'action_source', 'website',
      'content_name', m.product_code,
      'content_type', 'product',
      'content_ids', jsonb_build_array(m.product_code)
    )
  ) as payload,
  'pending' as status,
  0 as attempts,
  now() as run_at,
  m.order_created_at as created_at,
  m.order_created_at as updated_at
from orders_missing_capi m;

commit;

-- Optional diagnostics (run separately):
-- 1) How many orders still have no InitiateCheckout CAPI job
-- select count(*) as missing_initiate_checkout_jobs
-- from public.orders o
-- where o.order_ref is not null
--   and not exists (
--     select 1
--     from public.jobs j
--     where j.type = 'meta:capi'
--       and j.payload ->> 'event_name' = 'InitiateCheckout'
--       and j.payload ->> 'order_ref' = o.order_ref
--   );
--
-- 2) How many InitiateCheckout jobs are queued/running/failed/success
-- select status, count(*) from public.jobs
-- where type = 'meta:capi'
--   and payload ->> 'event_name' = 'InitiateCheckout'
-- group by status
-- order by status;
