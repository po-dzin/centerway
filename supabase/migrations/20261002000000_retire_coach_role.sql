-- CenterWay: retire the `coach` role.
--
-- Contract: src/lib/admin/accessTypes.ts (GRANTABLE_ROLES), src/lib/platform/adminRole.ts (STAFF_ROLES)
--
-- WHY. Decided by G on 2026-10-02: "author" and "coach" had blurred into one
-- thing, and only the author stays. An author is not a role: it is the owner
-- of a course, `lms_courses.author_id`, and sees their own drafts through it.
-- The role added one thing beside that, and the wrong one: as staff, a coach
-- opened every paid course without buying it.
--
-- Prod held no `coach` row when this was written (2 admin, 11 user). Any that
-- appears before it runs goes back to `user`, which is what the role grants
-- now: nothing beyond an ordinary account, plus whatever courses it owns.
--
-- Idempotent.

BEGIN;

UPDATE public.user_roles SET role = 'user', updated_at = now() WHERE role = 'coach';

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_check
  CHECK (role = ANY (ARRAY['user'::text, 'support'::text, 'admin'::text]));

COMMIT;
