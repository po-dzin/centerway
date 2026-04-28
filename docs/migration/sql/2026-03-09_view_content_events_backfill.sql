-- CenterWay: backfill local view_content events from historical CAPI jobs
-- Purpose: avoid temporary zeros after switching ViewContent source to local events.
-- Safe for reruns (idempotent by event_id dedupe).

begin;

insert into public.events (type, order_ref, payload, created_at)
select
  'view_content' as type,
  null as order_ref,
  jsonb_strip_nulls(
    jsonb_build_object(
      'event_name', 'ViewContent',
      'event_id', coalesce(j.payload->>'event_id', 'backfill_viewcontent_' || j.id::text),
      'event_time', j.payload->>'event_time',
      'event_source_url', j.payload->>'event_source_url',
      'fbclid', j.payload->>'fbclid',
      'fbp', j.payload->>'fbp',
      'content_name', j.payload->>'content_name',
      'content_type', j.payload->>'content_type',
      'content_ids', j.payload->'content_ids',
      'source', 'backfill_capi_jobs'
    )
  ) as payload,
  j.created_at
from public.jobs j
where
  j.type = 'meta:capi'
  and coalesce(j.payload->>'event_name', '') = 'ViewContent'
  and not exists (
    select 1
    from public.events e
    where
      e.type = 'view_content'
      and coalesce(e.payload->>'event_id', '') = coalesce(j.payload->>'event_id', '')
  );

commit;

