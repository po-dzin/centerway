-- Applied to production on 2026-08-29, recorded as version 20260829205051.
--
-- Its SQL was committed the next day at
-- `supabase/migrations/20260829205051_author_profile_background.sql` — tracked
-- only because it predated the rule that now gitignores that directory — and
-- deleted again on 2026-09-10 (e2e3839d) when the staging directory was
-- cleaned. It was never written HERE, so the repo's record of schema changes
-- has not mentioned it since.
--
-- Restored 2026-09-11 from `supabase_migrations.schema_migrations`, which had
-- kept the pushed statements, and verified byte-identical to the deleted blob
-- in 34acd54e. Nothing was lost; it was simply unfindable where people look.

-- A profile background is a decorative, author-owned public media object.
-- It stays separate from `photo`, which has an alt-text contract because it
-- identifies the author; this image is always rendered behind readable text.
ALTER TABLE public.lms_authors
  ADD COLUMN IF NOT EXISTS background jsonb NULL;
