-- A profile background is a decorative, author-owned public media object.
-- It stays separate from `photo`, which has an alt-text contract because it
-- identifies the author; this image is always rendered behind readable text.
ALTER TABLE public.lms_authors
  ADD COLUMN IF NOT EXISTS background jsonb NULL;
