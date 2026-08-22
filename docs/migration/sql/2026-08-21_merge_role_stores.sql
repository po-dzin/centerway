-- 2026-08-21 — one role store: public.user_roles. Retires platform_users.role.
--
-- WHY
-- This codebase carried two unsynchronised role columns since the admin
-- bootstrap and the customer schema were built separately, and nothing ever
-- merged them (see docs/design-system.md's sibling note and commit d87daba,
-- which chose per-row ownership for courses precisely to avoid the question).
-- Every RLS policy here authorises through `get_my_role()`, which reads
-- `user_roles` and only that. `platform_users.role` gated exactly one thing —
-- `isStaff()` in src/lib/lms/server.ts, "who may open a draft course" — and
-- that read moved to `user_roles` on the same day as this migration. So the
-- column now gates nothing, and a role column that gates nothing is worse than
-- no column: it looks authoritative and is not.
--
-- THE PART THAT MADE THIS URGENT RATHER THAT TIDY
-- `authenticated` holds UPDATE on platform_users.role at the column level, and
-- the policy "Users can update own platform profile" restricts the ROW
-- (auth.uid() = auth_user_id) without restricting which columns may change.
-- Its CHECK allowed 'coach', 'support' and 'admin'. Any signed-in user could
-- therefore have written their own row to 'coach' and, while isStaff() still
-- read this column, granted themselves draft-course access. Moving isStaff()
-- defused it; dropping the column removes it.
--
-- VERIFIED BEFORE WRITING (against production, 2026-08-21):
--   · no RLS policy, view, or function reads platform_users.role
--     (`sync_platform_user_from_auth` inserts the row but never sets role;
--      the only trigger on the table maintains updated_at)
--   · the two stores agreed for every account holding an elevated role, so
--     step 2 is a no-op today — it exists so the migration is correct if it is
--     ever replayed against a database where they had drifted
--   · stored values were 4×'user' + 2×'admin'; no 'coach', no 'support'

BEGIN;

-- 1. user_roles must be able to hold every role the retired column could.
--    'coach' is in platform_users' CHECK and in isStaffRole(), but user_roles'
--    CHECK forbids it. Without widening it first, retiring the other column
--    would make the staff role unassignable — a silent capability loss rather
--    than a merge.
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_check
  CHECK (role = ANY (ARRAY['user'::text, 'coach'::text, 'support'::text, 'admin'::text]));

-- 2. Carry over anything the retired column knows that user_roles does not.
--    Only ever upgrades: the guard on the conflict clause means an account
--    already elevated in user_roles is never demoted to what the other column
--    happened to say. Rows whose auth user is gone are skipped so the FK holds.
INSERT INTO public.user_roles (user_id, role)
SELECT pu.auth_user_id, pu.role
FROM public.platform_users pu
WHERE pu.auth_user_id IS NOT NULL
  AND pu.role IS NOT NULL
  AND pu.role <> 'user'
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = pu.auth_user_id)
ON CONFLICT (user_id) DO UPDATE
  SET role = EXCLUDED.role,
      updated_at = now()
  WHERE public.user_roles.role = 'user';

-- 3. Retire the column. Nothing in SQL or in the application reads it; the two
--    scripts that selected it (scripts/lms-grant.mjs, scripts/admin-role.mjs)
--    were updated in the same change.
ALTER TABLE public.platform_users DROP COLUMN IF EXISTS role;

COMMIT;

-- ROLLBACK, if it is ever needed. The column comes back empty — the values are
-- in user_roles, which is the point — so restoring the old behaviour means
-- backfilling from there, not from a backup:
--
--   ALTER TABLE public.platform_users
--     ADD COLUMN role text NOT NULL DEFAULT 'user'
--     CHECK (role = ANY (ARRAY['user','coach','admin','support']));
--   UPDATE public.platform_users pu SET role = ur.role
--     FROM public.user_roles ur WHERE ur.user_id = pu.auth_user_id;
--
-- Do not also restore the column-level UPDATE grant to `authenticated`.
