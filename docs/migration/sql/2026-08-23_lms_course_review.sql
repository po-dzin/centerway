-- Course authoring is independent from catalogue inclusion.
-- Existing published courses are trusted/backfilled; new drafts enter review explicitly.
ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.lms_courses SET review_status = 'approved', approved_at = COALESCE(approved_at, updated_at)
WHERE status = 'published' AND review_status = 'draft';

ALTER TABLE public.lms_courses DROP CONSTRAINT IF EXISTS lms_courses_review_status_check;
ALTER TABLE public.lms_courses ADD CONSTRAINT lms_courses_review_status_check
  CHECK (review_status IN ('draft', 'in_review', 'changes_requested', 'approved'));

CREATE INDEX IF NOT EXISTS idx_lms_courses_review ON public.lms_courses (review_status, updated_at DESC);
