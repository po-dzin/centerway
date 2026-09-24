-- CenterWay: the half of the artwork rewrite that was never written.
-- Contract: supabase/migrations/20260828060000_static_artwork_webp.sql
--
-- WHAT WENT WRONG. That migration pointed the database's artwork at the WebP
-- re-encode and its author then deleted the PNG/JPEG originals from the
-- repository (2bc42adc, «Remove superseded PNG/JPEG originals now that DB
-- points at WebP»). But it only ever rewrote `cover->>'src'` — and a cover
-- carries TWO paths. `mobileSrc` is the separate portrait master the course
-- hero uses on a phone, and it was left naming a file that the very next
-- commit removed. Three published courses have served a 404 as their mobile
-- hero since 2026-08-28:
--
--   short             /cw/platform/programs/reboot-card-v1.png
--   irem-gymnastics   /cw/platform/programs/irem-card-v1.png
--   reset-day         /cw/platform/programs/reset-day-card-v1.png
--
-- The `.webp` siblings have existed the whole time; the git snapshots in
-- data/courses/*.json already name them. Only the rows drifted.
--
-- WHY THE OLD VERIFICATION QUERY PASSED. It asked the same half-question the
-- UPDATE did — `cover->>'src'` — so it reported zero rows over a broken set.
-- The query at the foot of this file reads the whole cover object, and
-- `npm run media:check` asks it of every course, revision and lesson.
--
-- SAFE TO RE-RUN: the patterns exclude paths that already end in .webp.

-- ─── Live covers ────────────────────────────────────────────────────────────

UPDATE public.lms_courses
SET cover = jsonb_set(
      cover,
      '{mobileSrc}',
      to_jsonb(regexp_replace(cover->>'mobileSrc', '\.(png|jpe?g)$', '.webp'))
    )
WHERE cover ? 'mobileSrc'
  AND cover->>'mobileSrc' ~ '^/cw/(platform|courses)/.*\.(png|jpe?g)$';

-- ─── The same cover inside an open revision ─────────────────────────────────
--
-- `pending_content` is the working copy an author has open beside the live
-- release. It is not history: it is what they will publish next, so a stale
-- path there would simply be republished.

UPDATE public.lms_courses
SET pending_content = jsonb_set(
      pending_content,
      '{cover,mobileSrc}',
      to_jsonb(regexp_replace(pending_content->'cover'->>'mobileSrc', '\.(png|jpe?g)$', '.webp'))
    )
WHERE pending_content -> 'cover' ? 'mobileSrc'
  AND pending_content->'cover'->>'mobileSrc' ~ '^/cw/(platform|courses)/.*\.(png|jpe?g)$';

UPDATE public.lms_courses
SET pending_content = jsonb_set(
      pending_content,
      '{cover,src}',
      to_jsonb(regexp_replace(pending_content->'cover'->>'src', '\.(png|jpe?g)$', '.webp'))
    )
WHERE pending_content -> 'cover' ? 'src'
  AND pending_content->'cover'->>'src' ~ '^/cw/(platform|courses)/.*\.(png|jpe?g)$';

-- ─── A revision that lost the cover the release still has ───────────────────
--
-- One row today: `short`. Its open revision carries no `cover` key at all
-- while the published release carries a complete one, so the builder showed an
-- empty cover tab and one unexplained publication blocker over a course whose
-- photograph is on the storefront right now. A draft saying nothing about the
-- cover is not the same as a draft that removed it — removal is stored as the
-- key being present and the image being cleared, which `normalize()` in the
-- builder writes by deleting the whole object. This restores the release's own
-- cover into the draft; the author can still clear it deliberately afterwards.

UPDATE public.lms_courses
SET pending_content = jsonb_set(pending_content, '{cover}', cover)
WHERE pending_content IS NOT NULL
  AND cover IS NOT NULL
  AND NOT (pending_content ? 'cover');

-- ─── What is left naming a deleted original ─────────────────────────────────
-- Expect zero rows. `/cw/brand/**` is deliberately still PNG and is not matched.

SELECT slug,
       cover->>'src' AS cover_src,
       cover->>'mobileSrc' AS cover_mobile_src
FROM public.lms_courses
WHERE cover::text ~ '"/cw/(platform|courses)/[^"]+\.(png|jpe?g)"';
