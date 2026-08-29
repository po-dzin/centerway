-- CenterWay: reader annotations — bookmarks, highlights, margin notes.
--
-- WHAT THIS IS FOR
-- A protocol is read to be performed, and a reader marks the two lines they
-- will come back to. Until now the reader could only record that a lesson was
-- done; nothing let them say WHERE in it the thing they needed was.
--
-- PRIVATE, AND PRIVATE MEANS PRIVATE
-- These rows are the reader's own writing about someone else's text. Nobody
-- else may read them — not the course's author, not support, not an admin.
-- That is why this table, alone among the lms_* tables, has no staff policy:
-- an admin SELECT here would be reading a customer's private notes, and the
-- absence of that policy is the statement. Service-role code (/api/lms/*)
-- bypasses RLS as everywhere else and resolves the enrollment from the signed-in
-- user before it touches a row.
--
-- ANCHORING
-- A highlight is (block_id, start_offset, end_offset) over the block's rendered
-- plain text, plus the `quote` it was made from and the `prefix` before it.
-- Offsets alone break the moment an author edits a paragraph; the quote is what
-- lets the client re-find the passage, and `course_version` records what the
-- offsets were measured against. A mark whose quote is gone is not deleted —
-- it is shown in the notes list as detached rather than silently dropped, which
-- is the difference between "your note is safe" and "your note is gone".

CREATE TABLE IF NOT EXISTS public.lms_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Enrollment, not user: an annotation belongs to one reader IN one course,
  -- the same key progress is written against.
  enrollment_id uuid NOT NULL REFERENCES public.lms_enrollments(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lms_lessons(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('bookmark', 'highlight')),
  -- Anchor. NULL for a bookmark: a bookmark marks the lesson, not a passage.
  block_id text NULL,
  start_offset integer NULL CHECK (start_offset IS NULL OR start_offset >= 0),
  end_offset integer NULL CHECK (end_offset IS NULL OR end_offset >= 0),
  -- The marked text, and the ~40 characters before it. Both exist to re-find
  -- the passage after the author edits the lesson around it.
  quote text NULL,
  prefix text NULL,
  -- A highlight with a note IS the margin note; there is no third kind.
  note text NULL,
  -- What the offsets were measured against (lms_courses.version).
  course_version integer NOT NULL DEFAULT 1 CHECK (course_version > 0),
  -- Client-generated, like progress: the reader's device names the row before
  -- the server answers, so a retried write is an update rather than a twin.
  client_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, client_id),
  CONSTRAINT lms_annotations_anchor CHECK (
    (kind = 'bookmark'
      AND block_id IS NULL AND start_offset IS NULL AND end_offset IS NULL AND quote IS NULL)
    OR (kind = 'highlight'
      AND block_id IS NOT NULL AND start_offset IS NOT NULL AND end_offset IS NOT NULL
      AND end_offset > start_offset AND quote IS NOT NULL)
  )
);

-- One bookmark per lesson per reader: pressing it twice is a toggle, not a pile.
CREATE UNIQUE INDEX IF NOT EXISTS idx_lms_annotations_one_bookmark
  ON public.lms_annotations (enrollment_id, lesson_id)
  WHERE kind = 'bookmark';

CREATE INDEX IF NOT EXISTS idx_lms_annotations_lesson
  ON public.lms_annotations (enrollment_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_lms_annotations_recent
  ON public.lms_annotations (enrollment_id, created_at DESC);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_lms_annotations_updated_at') THEN
    CREATE TRIGGER trg_lms_annotations_updated_at
      BEFORE UPDATE ON public.lms_annotations
      FOR EACH ROW EXECUTE FUNCTION public.lms_set_updated_at();
  END IF;
END $$;

ALTER TABLE public.lms_annotations ENABLE ROW LEVEL SECURITY;

-- The owner, and only the owner. Four separate policies rather than FOR ALL, so
-- the write side carries WITH CHECK and a client cannot move a row onto someone
-- else's enrollment.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lms_annotations' AND policyname = 'Readers can view own annotations') THEN
    EXECUTE $p$ CREATE POLICY "Readers can view own annotations" ON public.lms_annotations FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.lms_enrollments e WHERE e.id = enrollment_id AND e.auth_user_id = auth.uid())) $p$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lms_annotations' AND policyname = 'Readers can write own annotations') THEN
    EXECUTE $p$ CREATE POLICY "Readers can write own annotations" ON public.lms_annotations FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM public.lms_enrollments e WHERE e.id = enrollment_id AND e.auth_user_id = auth.uid())) $p$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lms_annotations' AND policyname = 'Readers can edit own annotations') THEN
    EXECUTE $p$ CREATE POLICY "Readers can edit own annotations" ON public.lms_annotations FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.lms_enrollments e WHERE e.id = enrollment_id AND e.auth_user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.lms_enrollments e WHERE e.id = enrollment_id AND e.auth_user_id = auth.uid())) $p$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lms_annotations' AND policyname = 'Readers can delete own annotations') THEN
    EXECUTE $p$ CREATE POLICY "Readers can delete own annotations" ON public.lms_annotations FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.lms_enrollments e WHERE e.id = enrollment_id AND e.auth_user_id = auth.uid())) $p$;
  END IF;
END $$;

COMMENT ON TABLE public.lms_annotations IS
  'Reader''s private bookmarks, highlights and margin notes. No staff read policy on purpose — see the migration header.';
