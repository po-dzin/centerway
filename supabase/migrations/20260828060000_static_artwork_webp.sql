-- CenterWay: point the database's own artwork paths at the WebP re-encode.
-- Run in Supabase SQL editor.
-- Contract: scripts/img/webp.mjs, docs/perf/static-artwork-webp-2026-08-28.md
--
-- WHAT HAPPENED IN THE REPOSITORY. Forty shipped PNG/JPEG plates under
-- `public/cw/platform/**` and `public/cw/courses/**` were re-encoded to WebP:
-- 62.8 MB became 5.4 MB of the same pictures. Code and data files now name the
-- `.webp` sibling.
--
-- WHY THE DATABASE HAS AN OPINION AT ALL. A course's cover and a lesson's image
-- blocks are content, and content lives in rows. Some of those rows were seeded
-- from the same repository assets (2026-08-23_lms_course_marketplace_covers.sql)
-- and still name `.png`. They are not broken — the originals were deliberately
-- left in place — they are simply the expensive copy.
--
-- SAFE TO RUN LATE, SAFE TO NOT RUN. Until it runs, those rows serve the old
-- 2.4 MB file. After it runs, the originals may be deleted from the repository.
-- That ORDER is the whole point: delete first and a live course loses its cover.
--
-- SAFE TO RE-RUN: the pattern excludes paths that already end in .webp.
--
-- NOT RETROACTIVE, ON PURPOSE. `lms_course_revisions` is append-only and is not
-- touched here. A historical snapshot should keep saying what the course said
-- at the time, and it renders correctly for as long as the originals exist.

-- ─── Covers ─────────────────────────────────────────────────────────────────

UPDATE public.lms_courses
SET cover = jsonb_set(
      cover,
      '{src}',
      to_jsonb(regexp_replace(cover->>'src', '\.(png|jpe?g)$', '.webp'))
    )
WHERE cover ? 'src'
  AND cover->>'src' ~ '^/cw/(platform|courses)/.*\.(png|jpe?g)$';

-- ─── Image blocks inside lessons ────────────────────────────────────────────
--
-- A whole-document rewrite rather than a per-block one: `blocks` is an array of
-- differently shaped objects, and the only field that carries one of these
-- paths is an image block's `src`. Casting to text and back is blunt but it is
-- also exact — the pattern includes the leading `/cw/` and the extension, which
-- no other string in a lesson has.

UPDATE public.lms_lessons
SET blocks = regexp_replace(
      blocks::text,
      '("/cw/(?:platform|courses)/[^"]+)\.(png|jpe?g)"',
      '\1.webp"',
      'g'
    )::jsonb
WHERE blocks::text ~ '"/cw/(platform|courses)/[^"]+\.(png|jpe?g)"';

-- ─── What is left naming a PNG ──────────────────────────────────────────────
-- Expect zero rows. Anything here is a path outside the converted set —
-- `/cw/brand/**` is deliberately still PNG (manifest icons, the OG cover).

SELECT slug, cover->>'src' AS cover_src
FROM public.lms_courses
WHERE cover->>'src' ~ '^/cw/(platform|courses)/.*\.(png|jpe?g)$';
