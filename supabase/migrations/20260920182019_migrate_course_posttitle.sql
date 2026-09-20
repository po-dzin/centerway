-- `posttitle` was a third author line around a course name. It mostly stayed
-- empty and duplicated the title tail when filled, while the card needs one
-- author hook (`pretitle`) and one description. Preserve every non-empty value
-- before deleting the column:
--
--   * an empty course summary receives it as the description;
--   * otherwise an empty pretitle receives it as the author hook;
--   * a row that has all three values stops the migration for a human decision
--     rather than silently losing authored copy.
--
-- Pending revisions carry the same Course JSON and are migrated under the same
-- rule, so accepting a previously submitted revision cannot restore the field.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lms_courses' AND column_name = 'posttitle'
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.lms_courses
    WHERE NULLIF(btrim(posttitle), '') IS NOT NULL
      AND NOT (summary IS NULL OR jsonb_typeof(summary) = 'null' OR NULLIF(btrim(summary #>> '{}'), '') IS NULL)
      AND NULLIF(btrim(pretitle), '') IS NOT NULL
      AND lower(btrim(pretitle)) <> lower(btrim(posttitle))
  ) THEN
    RAISE EXCEPTION 'lms_course_posttitle_requires_copy_decision';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.lms_courses
    WHERE pending_content ? 'posttitle'
      AND NULLIF(btrim(pending_content->>'posttitle'), '') IS NOT NULL
      AND NULLIF(btrim(pending_content->>'summary'), '') IS NOT NULL
      AND NULLIF(btrim(pending_content->>'pretitle'), '') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'lms_course_pending_posttitle_requires_copy_decision';
  END IF;

  UPDATE public.lms_courses
  SET summary = CASE
        WHEN NULLIF(btrim(posttitle), '') IS NOT NULL
          AND (summary IS NULL OR jsonb_typeof(summary) = 'null' OR NULLIF(btrim(summary #>> '{}'), '') IS NULL)
          THEN to_jsonb(posttitle)
        ELSE summary
      END,
      pretitle = CASE
        WHEN NULLIF(btrim(posttitle), '') IS NOT NULL
          AND NOT (summary IS NULL OR jsonb_typeof(summary) = 'null' OR NULLIF(btrim(summary #>> '{}'), '') IS NULL)
          AND NULLIF(btrim(pretitle), '') IS NULL
          THEN posttitle
        ELSE pretitle
      END,
      pending_content = CASE
        WHEN pending_content ? 'posttitle' AND NULLIF(btrim(pending_content->>'posttitle'), '') IS NOT NULL THEN
          (pending_content - 'posttitle') || CASE
            WHEN NULLIF(btrim(pending_content->>'summary'), '') IS NULL
              THEN jsonb_build_object('summary', pending_content->'posttitle')
            WHEN NULLIF(btrim(pending_content->>'pretitle'), '') IS NULL
              THEN jsonb_build_object('pretitle', pending_content->'posttitle')
            ELSE '{}'::jsonb
          END
        WHEN pending_content ? 'posttitle' THEN pending_content - 'posttitle'
        ELSE pending_content
      END
  WHERE NULLIF(btrim(posttitle), '') IS NOT NULL OR pending_content ? 'posttitle';

  ALTER TABLE public.lms_courses DROP COLUMN posttitle;
END $$;
