-- Lesson-level version history, part 2: the JOURNAL.
--
-- WHAT WAS ALREADY HERE. 2026-08-23_lms_course_version_history.sql created
-- `lms_course_revisions` (append-only, service_role holds SELECT/INSERT and
-- nothing else) and `create_lms_course_revision`. It declared five checkpoint
-- kinds. Exactly one of them — `manual` — was ever written, because
-- docs/lms-course-version-history-2026-08-23.md deliberately held the other
-- four back:
--
--   "Restore, review and publish checkpoints stay disabled until their document
--    mutation and journal insert share one transaction. A two-request or
--    save-then-log implementation is forbidden because it can report failure
--    after the document has already changed."
--
-- That is the correct rule and this file is what unblocks it. Without the other
-- four kinds the table is an author convenience (snapshots they chose to keep),
-- not a journal: nothing records what a reviewer approved, what was released to
-- learners, or that a rollback happened. `audit_log` records the ACT of
-- approving; it has never recorded the DOCUMENT that was approved.
--
-- WHY THE MAPPING IS NOT IN THIS FILE. src/lib/lms/authoring.ts owns the
-- JSON <-> row mapping in both directions and is the single write path shared
-- by the builder, `lms:seed` and `lms:import` — so the builder cannot publish
-- anything the seed would reject. Re-stating the column list in PL/pgSQL would
-- create a second owner of that mapping that drifts silently the first time a
-- course column is added. So TypeScript still computes the rows (`courseRows`)
-- and this function is a DUMB TRANSACTIONAL APPLIER: it receives already-shaped
-- rows as jsonb and its only job is to make the projection and the journal
-- insert succeed or fail together. The column lists below are derived from the
-- catalog at run time, never typed out.

-- Generic upsert of a homogeneous row set, driven by the keys actually present
-- in the payload. Used for lms_modules and lms_lessons, whose rows `courseRows`
-- always emits complete.
CREATE OR REPLACE FUNCTION public.cw_apply_row_set(p_table regclass, p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_cols text;
  v_set text;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RETURN;
  END IF;

  -- Only keys that are real, live columns of the target table, in catalog
  -- order. A payload key that is not a column is ignored rather than raising:
  -- the alternative is that adding a field to the typed Course document breaks
  -- every write until the database catches up.
  SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum),
         string_agg(
           CASE WHEN a.attname = 'id' THEN NULL
                ELSE quote_ident(a.attname) || ' = EXCLUDED.' || quote_ident(a.attname) END,
           ', ' ORDER BY a.attnum)
    INTO v_cols, v_set
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = p_table
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND p_rows -> 0 ? a.attname;

  IF v_cols IS NULL THEN
    RAISE EXCEPTION 'cw_apply_row_set_no_columns:%', p_table;
  END IF;

  IF v_set IS NULL THEN
    EXECUTE format(
      'INSERT INTO %s (%s) SELECT %s FROM jsonb_populate_recordset(null::%s, $1) ON CONFLICT (id) DO NOTHING',
      p_table, v_cols, v_cols, p_table
    ) USING p_rows;
  ELSE
    EXECUTE format(
      'INSERT INTO %s (%s) SELECT %s FROM jsonb_populate_recordset(null::%s, $1) ON CONFLICT (id) DO UPDATE SET %s',
      p_table, v_cols, v_cols, p_table, v_set
    ) USING p_rows;
  END IF;
END;
$$;

-- Patch of one lms_courses row from the keys present in a jsonb object.
--
-- UPDATE, not a partial upsert — the same lesson authoring.ts records in prose
-- and pays for in production: Postgres builds the proposed tuple and enforces
-- NOT NULL on it BEFORE resolving the conflict, so a partial row raises 23502
-- on `slug` even when the row plainly exists. An absent key therefore means
-- "leave the stored value alone", which is exactly the `preserve` semantics the
-- TypeScript caller already decides.
CREATE OR REPLACE FUNCTION public.cw_patch_lms_course(p_course_id uuid, p_values jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_cols text;
BEGIN
  IF p_values IS NULL OR p_values = '{}'::jsonb THEN
    RETURN;
  END IF;

  SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum)
    INTO v_cols
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = 'public.lms_courses'::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND a.attname <> 'id'
    AND p_values ? a.attname;

  IF v_cols IS NULL THEN
    RETURN;
  END IF;

  EXECUTE format(
    'UPDATE public.lms_courses SET (%s) = (SELECT %s FROM jsonb_populate_record(null::public.lms_courses, $1)) WHERE id = $2',
    v_cols, v_cols
  ) USING p_values, p_course_id;
END;
$$;

-- ONE TRANSACTION: project a course document onto the learner-facing relational
-- rows AND append the immutable journal entry that says it happened.
--
-- Ordering inside the transaction still matters for a reader that is mid-page
-- while this commits, so it mirrors writeCourseStructure: course row without
-- status, then modules, then lessons, then removals, and only then the
-- status/version flip that makes a release live. The difference is that a
-- failure anywhere now rolls the whole thing back instead of leaving a course
-- half-written — the gap authoring.ts names and could not close without an RPC.
--
-- Removals are computed and GUARDED in TypeScript before this is called
-- (a lesson with learner progress must never be deleted); this function is
-- handed the already-approved id lists.
CREATE OR REPLACE FUNCTION public.apply_lms_course_release(
  p_course_id uuid,
  p_course jsonb,
  p_modules jsonb,
  p_lessons jsonb,
  p_remove_lesson_ids uuid[],
  p_remove_module_ids uuid[],
  p_final_values jsonb,
  p_kind text,
  p_content jsonb,
  p_content_hash text,
  p_created_by uuid DEFAULT NULL,
  p_label text DEFAULT NULL,
  p_source_revision_id uuid DEFAULT NULL
)
RETURNS TABLE (id uuid, revision_number bigint, created_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT true INTO v_exists FROM public.lms_courses c WHERE c.id = p_course_id;

  IF v_exists IS NULL THEN
    -- A course this function has never seen: the payload carries every NOT NULL
    -- column, so a plain insert is legal here and only here.
    PERFORM public.cw_apply_row_set('public.lms_courses'::regclass, jsonb_build_array(p_course));
  ELSE
    PERFORM public.cw_patch_lms_course(p_course_id, p_course);
  END IF;

  PERFORM public.cw_apply_row_set('public.lms_modules'::regclass, p_modules);
  PERFORM public.cw_apply_row_set('public.lms_lessons'::regclass, p_lessons);

  IF p_remove_lesson_ids IS NOT NULL AND array_length(p_remove_lesson_ids, 1) > 0 THEN
    DELETE FROM public.lms_lessons l WHERE l.id = ANY(p_remove_lesson_ids);
  END IF;

  IF p_remove_module_ids IS NOT NULL AND array_length(p_remove_module_ids, 1) > 0 THEN
    DELETE FROM public.lms_modules m WHERE m.id = ANY(p_remove_module_ids);
  END IF;

  -- The flip that makes a publish live, last.
  PERFORM public.cw_patch_lms_course(p_course_id, p_final_values);

  RETURN QUERY SELECT * FROM public.create_lms_course_revision(
    p_course_id, p_kind, p_content, p_content_hash,
    p_created_by, p_label, NULL, p_source_revision_id
  );
END;
$$;

-- The course-row-only half: a state change that moves no structure but must
-- still be provable — submitting for review, or withdrawing a release. Same
-- all-or-nothing rule, without the projection.
CREATE OR REPLACE FUNCTION public.journal_lms_course_state(
  p_course_id uuid,
  p_values jsonb,
  p_kind text,
  p_content jsonb,
  p_content_hash text,
  p_created_by uuid DEFAULT NULL,
  p_label text DEFAULT NULL,
  p_source_revision_id uuid DEFAULT NULL
)
RETURNS TABLE (id uuid, revision_number bigint, created_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.cw_patch_lms_course(p_course_id, p_values);

  RETURN QUERY SELECT * FROM public.create_lms_course_revision(
    p_course_id, p_kind, p_content, p_content_hash,
    p_created_by, p_label, NULL, p_source_revision_id
  );
END;
$$;

-- Same grant shape as create_lms_course_revision: server-only. Authorship is
-- decided by resolveBuilderIdentity/canEditCourse before any of this is reached.
REVOKE ALL ON FUNCTION public.cw_apply_row_set(regclass, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cw_patch_lms_course(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_lms_course_release(uuid, jsonb, jsonb, jsonb, uuid[], uuid[], jsonb, text, jsonb, text, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.journal_lms_course_state(uuid, jsonb, text, jsonb, text, uuid, text, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.cw_apply_row_set(regclass, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.cw_patch_lms_course(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_lms_course_release(uuid, jsonb, jsonb, jsonb, uuid[], uuid[], jsonb, text, jsonb, text, uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.journal_lms_course_state(uuid, jsonb, text, jsonb, text, uuid, text, uuid) TO service_role;
