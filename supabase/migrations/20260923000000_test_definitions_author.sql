-- 2026-09-23 · a test belongs to an author, the same way a course does
--
-- WHY. Programs and products carry a byline; tests did not. `test_definitions`
-- knew a slug, a title, a version and a status, and nothing about whose work it
-- is. That gap is not cosmetic: it is why the dosha test reads as platform
-- boilerplate rather than as one practitioner's instrument, and why its own
-- vocabulary (doshas, elements, constitution) had no owner to justify it.
--
-- SHAPE COPIED FROM `lms_courses.author_id`: a bare `uuid` holding an
-- `auth.users.id`, with an index, and the displayable profile resolved through
-- `lms_authors.auth_user_id`. Same column name, same resolution path, so one
-- rule covers courses and tests instead of two.
--
-- No foreign key, matching `lms_courses.author_id`, which has none either: the
-- authoring tables live outside `auth` and a hard reference there would couple
-- content deletion to account deletion.

alter table public.test_definitions
  add column if not exists author_id uuid;

comment on column public.test_definitions.author_id is
  'auth.users.id of the practitioner whose test this is; profile resolves via lms_authors.auth_user_id';

create index if not exists idx_test_definitions_author
  on public.test_definitions using btree (author_id);

-- The dosha test is the founder's instrument.
--
-- Resolved BY EMAIL rather than by a hardcoded uuid, exactly as
-- 20260829010000_lms_author_founder_link_user.sql resolves the same account:
-- the statement then reads as what it means, and is a no-op on any database
-- where that account is absent (local, preview) instead of writing a uuid that
-- belongs to nobody there.
update public.test_definitions d
   set author_id = u.id
  from auth.users u
 where d.slug = 'dosha-test'
   and d.author_id is null
   and u.email = 'centertheway@gmail.com';
