CREATE TABLE IF NOT EXISTS public.lms_course_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  revision_number bigint NOT NULL,
  kind text NOT NULL CHECK (kind IN ('manual', 'review_submitted', 'published', 'restored', 'autosave_checkpoint')),
  content jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  label text CHECK (label IS NULL OR char_length(label) BETWEEN 1 AND 120),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  parent_revision_id uuid,
  source_revision_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, revision_number),
  UNIQUE (course_id, id),
  CONSTRAINT lms_course_revisions_parent_fk
    FOREIGN KEY (course_id, parent_revision_id)
    REFERENCES public.lms_course_revisions(course_id, id),
  CONSTRAINT lms_course_revisions_source_fk
    FOREIGN KEY (course_id, source_revision_id)
    REFERENCES public.lms_course_revisions(course_id, id)
);

ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS revision_seq bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS draft_generation bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS published_revision_id uuid;

ALTER TABLE public.lms_courses DROP CONSTRAINT IF EXISTS lms_courses_published_revision_fk;
ALTER TABLE public.lms_courses ADD CONSTRAINT lms_courses_published_revision_fk
  FOREIGN KEY (id, published_revision_id)
  REFERENCES public.lms_course_revisions(course_id, id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lms_course_revisions_timeline
  ON public.lms_course_revisions(course_id, revision_number DESC);

ALTER TABLE public.lms_course_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.lms_course_revisions FROM anon, authenticated;
-- Revisions are append-only even for the server role. Course deletion can
-- still cascade through the foreign key; application code cannot rewrite or
-- erase individual historical snapshots.
REVOKE ALL ON TABLE public.lms_course_revisions FROM service_role;
GRANT SELECT, INSERT ON TABLE public.lms_course_revisions TO service_role;

CREATE OR REPLACE FUNCTION public.create_lms_course_revision(
  p_course_id uuid,
  p_kind text,
  p_content jsonb,
  p_content_hash text,
  p_created_by uuid DEFAULT NULL,
  p_label text DEFAULT NULL,
  p_parent_revision_id uuid DEFAULT NULL,
  p_source_revision_id uuid DEFAULT NULL
)
RETURNS TABLE (id uuid, revision_number bigint, created_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_revision_number bigint;
BEGIN
  UPDATE public.lms_courses
  SET revision_seq = revision_seq + 1
  WHERE public.lms_courses.id = p_course_id
  RETURNING revision_seq INTO v_revision_number;

  IF v_revision_number IS NULL THEN
    RAISE EXCEPTION 'lms_course_not_found';
  END IF;

  RETURN QUERY
  INSERT INTO public.lms_course_revisions (
    course_id, revision_number, kind, content, content_hash, label,
    created_by, parent_revision_id, source_revision_id
  ) VALUES (
    p_course_id, v_revision_number, p_kind, p_content, p_content_hash,
    NULLIF(btrim(p_label), ''), p_created_by, p_parent_revision_id,
    p_source_revision_id
  )
  RETURNING lms_course_revisions.id, lms_course_revisions.revision_number,
    lms_course_revisions.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.create_lms_course_revision(uuid, text, jsonb, text, uuid, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_lms_course_revision(uuid, text, jsonb, text, uuid, text, uuid, uuid) TO service_role;
