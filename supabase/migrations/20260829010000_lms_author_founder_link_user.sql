-- 2026-08-29 · link the founder's author row to the founder's account
--
-- WHY. `lms_authors.auth_user_id` was NULL on the only row the platform has.
-- The cabinet's editor writes through `upsertAuthorProfile()`, which upserts
-- with `onConflict: "auth_user_id"` — a NULL there matches nothing, so the
-- founder saving their profile would have INSERTED a second row (slug
-- `yevhenii-koriakin-2`) and both cards would have appeared on /experts and on
-- the home page. The row already exists and is already listed; what was missing
-- is the one column that says whose it is.
--
-- The account is centertheway@gmail.com — Євгеній. Resolved by email rather
-- than hardcoded so the statement reads as what it means, and is a no-op if the
-- account is absent.

update public.lms_authors a
   set auth_user_id = u.id
  from auth.users u
 where a.slug = 'yevhenii-koriakin'
   and a.auth_user_id is null
   and u.email = 'centertheway@gmail.com';
