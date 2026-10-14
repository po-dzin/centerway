-- 2026-10-14 · Author gallery: photographs and videos on the author's own page
--
-- G asked for a gallery on the author profile. It is one ordered jsonb array
-- on the author row, the same shape choice as `profile_blocks`: the gallery is
-- written and read only together with the profile, in one order the author
-- sets, and never queried by item.
--
-- Each item is `{id, kind: "image", src, alt, caption?}` or
-- `{id, kind: "video", provider: "youtube", videoId, caption?}`. The shape is
-- checked in TypeScript (`validateAuthor` in src/lms-core/author.ts); the
-- constraint below only keeps the column an array of at most 24.
--
-- Photographs live where portraits already do: `course-media/authors/<user>/
-- gallery/<asset>/`. Videos are YouTube ids, not files.
--
-- THE SWEEPER NOW KNOWS ABOUT AUTHORS. `lms_referenced_media()` listed only
-- course covers, lesson blocks and course revisions, and matched only
-- `courses/` paths. Every author portrait and backdrop already read as
-- unreferenced, so `npm run media:sweep:apply` would have deleted them after
-- the grace period. It now also reads the author rows (photo, background,
-- gallery) and matches `authors/` paths.
--
-- ROLLBACK:
--   alter table public.lms_authors drop constraint if exists lms_authors_gallery_shape;
--   alter table public.lms_authors drop column if exists gallery;
--   (and restore lms_referenced_media() from 20260828050000_lms_media_ledger.sql)

alter table public.lms_authors
  add column if not exists gallery jsonb null;

alter table public.lms_authors
  drop constraint if exists lms_authors_gallery_shape;
alter table public.lms_authors
  add constraint lms_authors_gallery_shape check (
    gallery is null
    or (jsonb_typeof(gallery) = 'array' and jsonb_array_length(gallery) <= 24)
  );

create or replace function public.lms_referenced_media()
returns table (asset_key text)
language sql stable
set search_path = ''
as $$
  with docs as (
    select cover::text as body from public.lms_courses where cover is not null
    union all
    select blocks::text from public.lms_lessons
    union all
    select content::text from public.lms_course_revisions
    union all
    select jsonb_build_array(photo, background, gallery)::text from public.lms_authors
  ),
  hits as (
    select distinct (regexp_matches(docs.body, 'course-media/((?:courses|authors)/[^"]+)', 'g'))[1] as object_path
    from docs
  )
  select distinct public.lms_media_asset_key(object_path) from hits;
$$;

revoke all on function public.lms_referenced_media() from public, anon, authenticated;
grant execute on function public.lms_referenced_media() to service_role;
