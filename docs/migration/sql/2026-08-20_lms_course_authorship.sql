-- LMS: course ownership, the prerequisite for the H2 builder.
--
-- Step 1 of docs/lms-authoring-pipeline-2026-08-19.md ("что делать дальше").
--
-- ─── Why ownership and NOT a role ────────────────────────────────────────────
--
-- The pipeline note planned "author_id + роль author на platform_users". The
-- column lands here; the role deliberately does not, for a concrete reason
-- rather than a preference:
--
--   * every RLS policy in this schema authorises through `public.get_my_role()`,
--     which reads `public.user_roles` — NOT `platform_users.role`. The two are
--     separate stores that nothing keeps in sync (`isStaff()` in
--     src/lib/lms/server.ts reads the platform_users one, `requireAdmin` reads
--     the user_roles one). An `author` value added to platform_users would be
--     invisible to RLS, so it could not gate anything here anyway.
--
--   * more importantly, a role is the wrong shape. Roles are global: an
--     `author` role says "may edit courses", not "may edit THESE courses".
--     With a second author on the platform that is precisely wrong. Ownership
--     is per-row, so it is the row that must carry it.
--
-- "May create a brand-new course" stays an admin action for now. That is the
-- only question a role would have answered, and it does not need answering
-- until an external author self-serves a course shell.
--
-- ─── Access impact: none, today ──────────────────────────────────────────────
--
-- author_id is left NULL on existing rows on purpose. A NULL author means
-- "admin-managed", which is exactly the current behaviour — so this migration
-- adds capability without changing anyone's access. Assigning authorship is a
-- deliberate, separate act.
--
-- Note that the app writes course structure through the service role
-- (`adminClient`), which bypasses RLS entirely. These policies are the gate for
-- the future builder, which must run under the author's own session — they are
-- defence in depth for the CLI path, not its enforcement.
--
-- Safe to re-run.

ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS author_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.lms_courses.author_id IS
  'Owning author. NULL means admin-managed. RLS lets an author read and edit only their own courses, including drafts.';

CREATE INDEX IF NOT EXISTS idx_lms_courses_author ON public.lms_courses (author_id);

-- ─────────────────────────────────────────
-- Author-scoped policies
-- ─────────────────────────────────────────
-- FOR ALL covers SELECT too, which is the point: the existing reader policy
-- only exposes `status = 'published'`, so without this an author could not open
-- the draft they are writing.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lms_courses' AND policyname = 'Authors can manage own courses'
  ) THEN
    EXECUTE $p$ CREATE POLICY "Authors can manage own courses" ON public.lms_courses
      FOR ALL
      USING (author_id IS NOT NULL AND author_id = auth.uid())
      WITH CHECK (author_id IS NOT NULL AND author_id = auth.uid()) $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lms_modules' AND policyname = 'Authors can manage own modules'
  ) THEN
    EXECUTE $p$ CREATE POLICY "Authors can manage own modules" ON public.lms_modules
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

  -- lms_lessons carries course_id directly, so this joins to the course rather
  -- than hopping through modules.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lms_lessons' AND policyname = 'Authors can manage own lessons'
  ) THEN
    EXECUTE $p$ CREATE POLICY "Authors can manage own lessons" ON public.lms_lessons
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
END $$;
