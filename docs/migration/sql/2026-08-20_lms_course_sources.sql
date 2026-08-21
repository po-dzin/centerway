-- LMS: raw author materials a course is built from.
--
-- Step 2 of docs/lms-authoring-pipeline-2026-08-19.md.
--
-- An author does not bring a course, they bring materials: a docx of
-- instructions, a pdf protocol, a video, a reporting table. This is the layer
-- between "materials" and "course" — without it, way21's 16 lessons exist with
-- no record of what any of them was derived from.
--
-- ─── Why no file blob, and no Supabase Storage ───────────────────────────────
--
-- The table stores EXTRACTED TEXT, not the original file. Two reasons:
--
--   * extraction is an agent capability, not a server one. The agent already
--     reads docx/pdf/video transcripts natively; making the server re-implement
--     that would add parsing libraries to reproduce something the writer can
--     already do. The agent extracts, the platform stores what was extracted.
--   * this project uses Supabase Storage nowhere today. Introducing a bucket,
--     its policies and its lifecycle is a real decision and it is not what step
--     2 is for. Archiving originals can be added later against `origin` and
--     `checksum`, which are recorded precisely so a file can be re-associated.
--
-- ─── Visibility ──────────────────────────────────────────────────────────────
--
-- Learners get NO access, deliberately. There is no "published courses are
-- readable" analogue here: sources are the author's raw working material, which
-- may contain unedited notes, personal data or medical claims that never passed
-- the readiness gate. Only the course's author and staff may read them.
--
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.lms_course_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  -- What the author handed over. `note` covers material typed straight into the
  -- builder rather than uploaded.
  kind text NOT NULL CHECK (kind IN ('document', 'transcript', 'video', 'link', 'note')),
  title text NOT NULL,
  -- Original filename or URL — how the author refers to it in conversation.
  origin text NULL,
  mime_type text NULL,
  byte_size integer NULL CHECK (byte_size IS NULL OR byte_size >= 0),
  -- sha256 of the ORIGINAL file. Lets the same document be recognised on
  -- re-registration, and lets a blob be re-attached later if originals are ever
  -- archived.
  checksum text NULL,
  -- What the builder and the agent actually read.
  extracted_text text NULL,
  uploaded_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lms_course_sources_course
  ON public.lms_course_sources (course_id, created_at DESC);

-- Registering the same file against the same course twice is an accident, not
-- an intent. Partial, because a `note` or a `link` legitimately has no checksum.
CREATE UNIQUE INDEX IF NOT EXISTS uq_lms_course_sources_checksum
  ON public.lms_course_sources (course_id, checksum)
  WHERE checksum IS NOT NULL;

DROP TRIGGER IF EXISTS trg_lms_course_sources_updated_at ON public.lms_course_sources;
CREATE TRIGGER trg_lms_course_sources_updated_at
  BEFORE UPDATE ON public.lms_course_sources
  FOR EACH ROW EXECUTE FUNCTION public.lms_set_updated_at();

ALTER TABLE public.lms_course_sources ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lms_course_sources' AND policyname = 'Authors can manage own course sources'
  ) THEN
    EXECUTE $p$ CREATE POLICY "Authors can manage own course sources" ON public.lms_course_sources
      FOR ALL
      USING (EXISTS (
        SELECT 1 FROM public.lms_courses c
        WHERE c.id = course_id AND c.author_id IS NOT NULL AND c.author_id = auth.uid()
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.lms_courses c
        WHERE c.id = course_id AND c.author_id IS NOT NULL AND c.author_id = auth.uid()
      )) $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lms_course_sources' AND policyname = 'Staff can manage course sources'
  ) THEN
    EXECUTE $p$ CREATE POLICY "Staff can manage course sources" ON public.lms_course_sources
      FOR ALL USING (public.get_my_role() in ('admin', 'support')) $p$;
  END IF;
END $$;
