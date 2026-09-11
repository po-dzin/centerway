--
-- Invented people for the local stack. HAND-WRITTEN — `db:local:sync` never
-- touches this file.
--
-- Production's customers, orders and payments are deliberately NOT copied here.
-- Real emails, phone numbers and payment records have no business sitting on a
-- laptop or in a git history, and no checkout bug needs them to be real. What a
-- local check actually needs is one of each SHAPE: an admin, a paying student
-- with live access, a student whose access has run out, and a stranger.
--
-- Every row is written against a subquery rather than a literal id, so the file
-- survives `db:local:sync` bringing in different courses tomorrow.
--
-- Sign-ins (password for all three: local-dev)
--   admin@local.test    — admin role, sees the admin app
--   student@local.test  — paid, enrolled, access live
--   expired@local.test  — paid once, enrolment expired yesterday
--

begin;

-- Auth accounts -------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-a000-000000000001',
   'authenticated', 'authenticated', 'admin@local.test',
   crypt('local-dev', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Локальний адмін"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-a000-000000000002',
   'authenticated', 'authenticated', 'student@local.test',
   crypt('local-dev', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Оксана Тест"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-a000-000000000003',
   'authenticated', 'authenticated', 'expired@local.test',
   crypt('local-dev', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Ігор Тест"}', now(), now())
on conflict (id) do nothing;

-- Platform profiles ---------------------------------------------------------

insert into public.platform_users (auth_user_id, email, full_name, provider, onboarding_state, last_sign_in_at)
values
  ('00000000-0000-4000-a000-000000000001', 'admin@local.test',   'Локальний адмін', 'email', 'active', now()),
  ('00000000-0000-4000-a000-000000000002', 'student@local.test', 'Оксана Тест',     'email', 'active', now()),
  ('00000000-0000-4000-a000-000000000003', 'expired@local.test', 'Ігор Тест',       'email', 'test_completed', now() - interval '40 days')
on conflict do nothing;

-- Roles. user_roles is the ONE role store (platform_users.role was removed
-- 2026-08-21); granting anywhere else is a silent no-op.

insert into public.user_roles (user_id, role)
values ('00000000-0000-4000-a000-000000000001', 'admin')
on conflict (user_id) do update set role = excluded.role;

-- The founder's own account, whichever id `sync` brought in, is admin too —
-- otherwise the author who owns the seeded courses cannot open the builder.
insert into public.user_roles (user_id, role)
select auth_user_id, 'admin' from public.lms_authors
where auth_user_id is not null
on conflict (user_id) do update set role = excluded.role;

-- Customers -----------------------------------------------------------------

insert into public.customers (id, email, display_name, auth_user_id, tags)
values
  ('00000000-0000-4000-b000-000000000002', 'student@local.test', 'Оксана Тест',
   '00000000-0000-4000-a000-000000000002', '{local}'),
  ('00000000-0000-4000-b000-000000000003', 'expired@local.test', 'Ігор Тест',
   '00000000-0000-4000-a000-000000000003', '{local}')
on conflict (id) do nothing;

-- One paid order per shape, against a real offer code so the checkout and the
-- thank-you page resolve a product instead of falling through to 404.

insert into public.orders (order_ref, product_code, amount, currency, status, customer_id, created_at)
select
  'LOCAL-PAID-0001',
  offer.code,
  offer.amount,
  coalesce(offer.currency, 'UAH'),
  'paid',
  '00000000-0000-4000-b000-000000000002',
  now() - interval '3 days'
from public.lms_course_offers offer
join public.lms_courses course on course.id = offer.course_id
where offer.active and course.status = 'published'
order by offer.created_at
limit 1
on conflict do nothing;

insert into public.orders (order_ref, product_code, amount, currency, status, customer_id, created_at)
select
  'LOCAL-PENDING-0002',
  offer.code,
  offer.amount,
  coalesce(offer.currency, 'UAH'),
  'created',
  '00000000-0000-4000-b000-000000000003',
  now() - interval '2 hours'
from public.lms_course_offers offer
join public.lms_courses course on course.id = offer.course_id
where offer.active and course.status = 'published'
order by offer.created_at
limit 1
on conflict do nothing;

insert into public.payments (provider, order_ref, provider_tx_id, status, raw_payload, created_at)
values ('wfp', 'LOCAL-PAID-0001', 'local-tx-0001', 'Approved',
        '{"note":"invented locally, never a real transaction"}', now() - interval '3 days')
on conflict do nothing;

-- Access. The token is not the right; `lms_enrollments.expires_at` is — which
-- is exactly why one of these two has run out.

insert into public.lms_enrollments (course_id, auth_user_id, source, order_ref, expires_at)
select course.id, '00000000-0000-4000-a000-000000000002', 'order', 'LOCAL-PAID-0001',
       now() + interval '300 days'
from public.lms_courses course
where course.status = 'published'
order by course.sort_order nulls last, course.created_at
limit 1
on conflict do nothing;

insert into public.lms_enrollments (course_id, auth_user_id, source, order_ref, expires_at)
select course.id, '00000000-0000-4000-a000-000000000003', 'order', 'LOCAL-EXPIRED-0003',
       now() - interval '1 day'
from public.lms_courses course
where course.status = 'published'
order by course.sort_order nulls last, course.created_at
limit 1
on conflict do nothing;

commit;
