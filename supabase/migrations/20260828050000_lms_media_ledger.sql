-- CenterWay: a record of what the bucket holds, and a way to ask what it can lose.
-- Run in Supabase SQL editor.
-- Contract: src/app/api/lms/authoring/media/route.ts, scripts/media-sweep.mjs
-- Notes:   docs/media-weight-2026-08-28.md, docs/plans-and-quotas-2026-08-28.md
--
-- ─── The two questions this answers, which are not the same question ────────
--
-- 1. HOW MUCH DOES THIS COURSE OCCUPY? Asked on a request path, for a quota.
--    Answering it by listing a bucket is answering it the wrong way: object
--    listing is paginated, per-prefix, and slow enough to be felt. So every
--    upload writes a row, and the answer is a SUM over an index.
--
-- 2. WHAT IN THE BUCKET IS NO LONGER REFERENCED? Asked nightly, by a sweeper.
--    This one must NOT be answered from the ledger, and the difference matters:
--    the ledger knows what this application believes it wrote, and the whole
--    point of a sweeper is to find what it does not believe in — objects from
--    before the ledger existed, objects left by a half-finished write. Ground
--    truth for question 2 is `storage.objects` itself.
--
-- The ledger is therefore an accounting record, not an inventory. Two functions
-- below, one for each question, so neither pretends to be the other.
--
-- Safe to re-run.

-- ─── The asset key ──────────────────────────────────────────────────────────
--
-- An upload is one asset and several objects: `<folder>/1600.webp` and
-- `<folder>/640.webp` are one picture, and either the whole picture is
-- referenced or none of it is. The key collapses renditions to the folder that
-- holds them.
--
-- IT MUST ALSO SURVIVE THE OLD SHAPE. Images uploaded before 2026-08-28 sit at
-- a flat `courses/<course>/<uuid>.webp` with no folder of their own. Blindly
-- taking the directory would collapse every legacy image of a course into one
-- key — and then a sweeper would see one unreferenced "asset" and delete a
-- course's entire image history in one move. So the rule is explicit about
-- which trailing names are renditions, and anything else is its own asset.
--
-- Both sides of the sweep call this. A key derived two ways is a key that will
-- eventually disagree with itself, and here that disagreement deletes files.

CREATE OR REPLACE FUNCTION public.lms_media_asset_key(object_path text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN object_path ~ '/(1600|640)\.webp$' OR object_path ~ '/original\.gif$'
      THEN regexp_replace(object_path, '/[^/]+$', '')
    ELSE object_path
  END;
$$;

-- ─── 1. The ledger ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lms_media_assets (
  -- The uuid in the path. The route generates it, so the row and the objects
  -- carry the same identity without a lookup.
  id uuid PRIMARY KEY,
  -- SET NULL rather than CASCADE, deliberately. Deleting the row when the
  -- course goes would erase exactly the record the sweeper needs to know those
  -- bytes are now free — the ledger would tidy away its own evidence. The path
  -- still carries the course id, so nothing is actually lost.
  course_id uuid REFERENCES public.lms_courses(id) ON DELETE SET NULL,
  -- `courses/<course-id>/<uuid>` for a rendition folder; the object path itself
  -- for anything single-file. Always equals lms_media_asset_key(canonical_path).
  asset_key text NOT NULL UNIQUE,
  -- What `src` points at — the widest rendition.
  canonical_path text NOT NULL,
  -- Every object written for this asset, so a sweep removes all of it.
  paths text[] NOT NULL CHECK (array_length(paths, 1) >= 1),
  -- Sum across renditions. The number a quota adds up.
  bytes bigint NOT NULL CHECK (bytes > 0),
  content_type text NOT NULL,
  width integer NOT NULL,
  height integer NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Set by the sweeper when the objects are gone. The row stays: what an
  -- account once stored is history, and deleting the record of a deletion
  -- makes every later question about growth unanswerable.
  swept_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_lms_media_assets_course
  ON public.lms_media_assets (course_id) WHERE swept_at IS NULL;

ALTER TABLE public.lms_media_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.lms_media_assets FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.lms_media_assets TO service_role;

-- What a course occupies right now. The quota question, as one indexed sum.
CREATE OR REPLACE VIEW public.lms_media_usage
WITH (security_invoker = true) AS
  SELECT course_id, count(*) AS assets, sum(bytes) AS bytes
  FROM public.lms_media_assets
  WHERE swept_at IS NULL AND course_id IS NOT NULL
  GROUP BY course_id;

REVOKE ALL ON public.lms_media_usage FROM anon, authenticated;
GRANT SELECT ON public.lms_media_usage TO service_role;

-- ─── 2. What the bucket actually holds ──────────────────────────────────────
--
-- SECURITY DEFINER because `storage.objects` is not readable by the API roles
-- and should not become readable: this exposes one aggregate shape, to one
-- role, and nothing else.

CREATE OR REPLACE FUNCTION public.lms_media_inventory()
RETURNS TABLE (asset_key text, objects text[], bytes bigint, newest timestamptz)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT
    public.lms_media_asset_key(o.name) AS asset_key,
    array_agg(o.name ORDER BY o.name),
    COALESCE(sum((o.metadata->>'size')::bigint), 0),
    max(o.created_at)
  FROM storage.objects o
  WHERE o.bucket_id = 'course-media'
    -- Supabase writes a zero-byte marker to keep an empty folder visible. It is
    -- not an asset, and letting it read as one would put a permanent phantom
    -- orphan in every sweep report.
    AND o.name NOT LIKE '%.emptyFolderPlaceholder'
  GROUP BY 1;
$$;

REVOKE ALL ON FUNCTION public.lms_media_inventory() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lms_media_inventory() TO service_role;

-- ─── 3. What content still points at ────────────────────────────────────────
--
-- THREE SOURCES, AND THE THIRD IS THE INTERESTING ONE. A course's cover and a
-- lesson's blocks are the live answer. `lms_course_revisions` is the historical
-- one, and it counts: version history exists so an author can restore a version,
-- and restoring a version whose images were swept restores a page of broken
-- frames. History is append-only precisely so it can be trusted; a sweeper that
-- ignored it would make that guarantee a lie.
--
-- The practical consequence, stated plainly: an image that was ever SAVED is
-- kept forever. What this sweep collects is what was never saved (uploaded,
-- then replaced before the author pressed save) and everything belonging to
-- deleted courses — whose revisions cascade away with them, which is what makes
-- those assets collectable at all.

CREATE OR REPLACE FUNCTION public.lms_referenced_media()
RETURNS TABLE (asset_key text)
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  WITH docs AS (
    SELECT cover::text AS body FROM public.lms_courses WHERE cover IS NOT NULL
    UNION ALL
    SELECT blocks::text FROM public.lms_lessons
    UNION ALL
    SELECT content::text FROM public.lms_course_revisions
  ),
  hits AS (
    -- The body is JSON rendered as text, so a `src` value is bounded by the
    -- quote that closes it. That is a tighter and less escape-prone stop than
    -- trying to enumerate what may not appear in a path. Subscripted in place
    -- rather than aliased as a table, where `m[1]` would be reaching for a name
    -- that is both the relation and its only column.
    SELECT DISTINCT (regexp_matches(docs.body, 'course-media/(courses/[^"]+)', 'g'))[1] AS object_path
    FROM docs
  )
  SELECT DISTINCT public.lms_media_asset_key(object_path) FROM hits;
$$;

REVOKE ALL ON FUNCTION public.lms_referenced_media() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lms_referenced_media() TO service_role;

-- ─── Backfill ───────────────────────────────────────────────────────────────
--
-- Everything already in the bucket predates the ledger. Recorded here so the
-- quota sum is true from the first day rather than from the next upload —
-- without it, an author who has already filled a gigabyte reads as empty.
--
-- `created_at` comes from the object rather than from now(): the point of a
-- backfill is that these are old.

WITH scanned AS (
  SELECT
    inv.*,
    -- The uuid is in the path: the folder name for a rendition set, the file
    -- name for a legacy flat object. Anything that is not one gets a fresh uuid
    -- — the id is an accounting identity, not a join key onto storage.
    regexp_replace(regexp_replace(inv.asset_key, '^.*/', ''), '\.[a-z0-9]+$', '') AS tail,
    -- NOT `objects[last]`: sorted as text, '1600.webp' sorts BEFORE '640.webp',
    -- so the last element is the SMALL rendition. `src` points at the widest.
    COALESCE(
      (SELECT t.p FROM unnest(inv.objects) AS t(p) WHERE t.p LIKE '%/1600.webp' LIMIT 1),
      inv.objects[1]
    ) AS canonical
  FROM public.lms_media_inventory() inv
)
INSERT INTO public.lms_media_assets (
  id, course_id, asset_key, canonical_path, paths, bytes, content_type, width, height, created_at
)
SELECT
  CASE WHEN s.tail ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN s.tail::uuid ELSE gen_random_uuid() END,
  -- Looked up rather than parsed straight in: the assets most worth recording
  -- are the ones whose course is already deleted, and handing that id to a
  -- foreign key would fail the entire backfill on exactly those rows.
  (SELECT c.id FROM public.lms_courses c
    WHERE c.id::text = (regexp_match(s.asset_key,
      '^courses/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/'))[1]),
  s.asset_key,
  s.canonical,
  s.objects,
  GREATEST(s.bytes, 1),
  CASE
    WHEN s.canonical LIKE '%.gif' THEN 'image/gif'
    WHEN s.canonical LIKE '%.png' THEN 'image/png'
    WHEN s.canonical LIKE '%.jpg' OR s.canonical LIKE '%.jpeg' THEN 'image/jpeg'
    WHEN s.canonical LIKE '%.avif' THEN 'image/avif'
    ELSE 'image/webp'
  END,
  -- Zero means unmeasured, not zero-sized. Reading a backfilled object's real
  -- dimensions would mean fetching every file, and nothing needs them: the
  -- columns exist for what the pipeline reports on the way in.
  0,
  0,
  s.newest
FROM scanned s
WHERE NOT EXISTS (
  SELECT 1 FROM public.lms_media_assets a WHERE a.asset_key = s.asset_key
)
ON CONFLICT (id) DO NOTHING;

-- ─── What the sweeper would collect, as a read-only look ────────────────────

SELECT inv.asset_key, inv.bytes, inv.newest
FROM public.lms_media_inventory() inv
WHERE NOT EXISTS (
  SELECT 1 FROM public.lms_referenced_media() r WHERE r.asset_key = inv.asset_key
)
ORDER BY inv.newest;
