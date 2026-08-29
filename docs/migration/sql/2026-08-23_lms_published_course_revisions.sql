-- One published course keeps one live release and, at most, one working next
-- release. The JSON is intentional: the revision is a complete typed Course
-- document, while lms_courses/lms_modules/lms_lessons remain the stable live
-- relational projection read by learners and enrollments.
ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS pending_content jsonb,
  ADD COLUMN IF NOT EXISTS pending_review_status text,
  ADD COLUMN IF NOT EXISTS pending_review_note text,
  ADD COLUMN IF NOT EXISTS pending_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_updated_at timestamptz;

ALTER TABLE public.lms_courses DROP CONSTRAINT IF EXISTS lms_courses_pending_review_status_check;
ALTER TABLE public.lms_courses ADD CONSTRAINT lms_courses_pending_review_status_check
  CHECK (pending_review_status IS NULL OR pending_review_status IN ('draft', 'in_review', 'changes_requested'));

ALTER TABLE public.lms_courses DROP CONSTRAINT IF EXISTS lms_courses_pending_content_review_check;
ALTER TABLE public.lms_courses ADD CONSTRAINT lms_courses_pending_content_review_check
  CHECK ((pending_content IS NULL) = (pending_review_status IS NULL));

CREATE INDEX IF NOT EXISTS idx_lms_courses_pending_review
  ON public.lms_courses (pending_review_status, pending_updated_at DESC)
  WHERE pending_content IS NOT NULL;
