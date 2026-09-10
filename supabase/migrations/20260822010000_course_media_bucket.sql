-- CenterWay: somewhere for an author's own images to live.
-- Run in Supabase SQL editor.
-- Contract: src/app/api/lms/authoring/media/route.ts
--
-- THE DECISION THIS REVERSES, ON PURPOSE. The 2026-08-20 sources migration
-- said plainly: "this project uses Supabase Storage nowhere today. Introducing
-- a bucket, its policies and its lifecycle is a real decision and it is not
-- what step 2 is for." It still was a real decision — this is it, taken
-- deliberately, because an image field that only accepts a path is a field that
-- asks an author to be a deployer. They have a file; the builder has to take it.
--
-- Both ways stay. A link is still a link: an image already on a CDN, or one of
-- the artwork files that ship in /public, needs no copy here.
--
-- ─── Why public ──────────────────────────────────────────────────────────────
--
-- A course image is rendered by a browser that may not be signed in — the offer
-- page, the OG card, the catalogue. Signed URLs would have to be minted per
-- render and would expire inside a cached page. And an image is not a secret:
-- the thing worth protecting is the LESSON, and lessons are not here.
--
-- The cost, stated: an unpublished course's cover is fetchable by anyone who
-- has the URL. The path carries a uuid, so having it means someone gave it to
-- you, but this is not a place for anything private.
--
-- ─── Why no client write policy ──────────────────────────────────────────────
--
-- Nothing writes here except the server, holding the service role, inside
-- /api/lms/authoring/media — which checks that the caller may edit THAT course
-- before it touches the bucket. Encoding the same ownership rule a second time
-- as a storage policy would be two rules that can disagree about who an author
-- is, and the API route is the one that already knows.
--
-- Safe to re-run.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-media',
  'course-media',
  true,
  -- 5 MB. Enforced in the route as well; this is the floor under a route that
  -- someone later edits without thinking about size.
  5242880,
  -- No SVG. An SVG is a document that can carry script, and while an <img> tag
  -- never runs it, a direct visit to the object URL does — on the storage
  -- origin, where a signed-in Supabase session lives. The gain for course
  -- photography is nil and the question is not worth leaving open.
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Reading is explicit rather than relying on the bucket flag alone: the flag is
-- what makes the public URL work, and this is what makes a direct object read
-- work the same way. Two names for one intention, and both are asked for.
DROP POLICY IF EXISTS course_media_public_read ON storage.objects;

CREATE POLICY course_media_public_read ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'course-media');
