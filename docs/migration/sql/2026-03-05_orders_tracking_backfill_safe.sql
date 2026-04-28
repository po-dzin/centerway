-- CenterWay: SAFE backfill for tracking fields on legacy orders
-- Goal: fill missing orders.campaign/fbclid/fbp/page_url from reliable sources only.
-- Safety rules:
-- 1) Never overwrite non-empty fields in orders.
-- 2) Use strict order_ref matches only.
-- 3) Use latest row per order_ref from source tables.

begin;

-- ---------------------------------------------
-- A) Fill campaign from existing orders.page_url query params
-- ---------------------------------------------
update public.orders o
set campaign = nullif((regexp_match(o.page_url, '(?:[?&]utm_campaign=)([^&#]+)'))[1], '')
where (o.campaign is null or trim(o.campaign) = '')
  and o.page_url is not null
  and o.page_url ~ '(?:[?&]utm_campaign=)';

-- ---------------------------------------------
-- B) Backfill from leads (strict order_ref)
-- ---------------------------------------------
with leads_latest as (
  select distinct on (l.order_ref)
    l.order_ref,
    nullif(trim(l.campaign), '') as campaign,
    nullif(trim(l.fbclid), '') as fbclid,
    nullif(trim(l.fbp), '') as fbp,
    nullif(trim(l.page_url), '') as page_url
  from public.leads l
  where l.order_ref is not null
  order by l.order_ref, l.created_at desc
)
update public.orders o
set
  campaign = coalesce(nullif(trim(o.campaign), ''), ll.campaign),
  fbclid = coalesce(nullif(trim(o.fbclid), ''), ll.fbclid),
  fbp = coalesce(nullif(trim(o.fbp), ''), ll.fbp),
  page_url = coalesce(nullif(trim(o.page_url), ''), ll.page_url)
from leads_latest ll
where o.order_ref = ll.order_ref
  and (
    (o.campaign is null or trim(o.campaign) = '') and ll.campaign is not null
    or (o.fbclid is null or trim(o.fbclid) = '') and ll.fbclid is not null
    or (o.fbp is null or trim(o.fbp) = '') and ll.fbp is not null
    or (o.page_url is null or trim(o.page_url) = '') and ll.page_url is not null
  );

-- ---------------------------------------------
-- C) Backfill from checkout_started events payload (strict order_ref)
-- ---------------------------------------------
with events_latest as (
  select distinct on (e.order_ref)
    e.order_ref,
    nullif(trim(e.payload ->> 'utm_campaign'), '') as campaign,
    nullif(trim(e.payload ->> 'fbclid'), '') as fbclid,
    nullif(trim(e.payload ->> 'fbp'), '') as fbp,
    nullif(trim(e.payload ->> 'page_url'), '') as page_url
  from public.events e
  where e.type = 'checkout_started'
    and e.order_ref is not null
  order by e.order_ref, e.created_at desc
)
update public.orders o
set
  campaign = coalesce(nullif(trim(o.campaign), ''), el.campaign),
  fbclid = coalesce(nullif(trim(o.fbclid), ''), el.fbclid),
  fbp = coalesce(nullif(trim(o.fbp), ''), el.fbp),
  page_url = coalesce(nullif(trim(o.page_url), ''), el.page_url)
from events_latest el
where o.order_ref = el.order_ref
  and (
    (o.campaign is null or trim(o.campaign) = '') and el.campaign is not null
    or (o.fbclid is null or trim(o.fbclid) = '') and el.fbclid is not null
    or (o.fbp is null or trim(o.fbp) = '') and el.fbp is not null
    or (o.page_url is null or trim(o.page_url) = '') and el.page_url is not null
  );

commit;

-- Optional diagnostics (run separately):
-- select
--   count(*) filter (where campaign is null or campaign='') as missing_campaign,
--   count(*) filter (where fbclid is null or fbclid='') as missing_fbclid,
--   count(*) filter (where fbp is null or fbp='') as missing_fbp,
--   count(*) filter (where page_url is null or page_url='') as missing_page_url
-- from public.orders;
