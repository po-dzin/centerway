-- 2026-09-28 · the balance test gets its row, and its author
--
-- «Внутрішній простір і баланс дош» — the second test on the platform. Its
-- questions, scoring and result copy live in code (src/lib/balance/balanceTest.ts):
-- the test_questions / test_options tables are the dosha test's instrument, and
-- their constraints admit three doshas, not the fourth reading — `balance` —
-- this test is built around.
--
-- The row exists for the same reason the dosha test's `author_id` does: a test
-- is authored material and prints a byline (getTestAuthor('balance-test')).
-- Idempotent, and the author is resolved BY EMAIL exactly as in
-- 20260923000000_test_definitions_author.sql, so on a database without that
-- account (local, preview) the row lands unclaimed instead of pointing at a
-- uuid that belongs to nobody there.

insert into public.test_definitions (slug, title, version, status, author_id)
select 'balance-test', 'Внутрішній простір і баланс дош', 'v1', 'active', u.id
  from (select 1) as one
  left join auth.users u on u.email = 'centertheway@gmail.com'
on conflict (slug) do update
   set author_id = coalesce(public.test_definitions.author_id, excluded.author_id);

-- And its place in the experiences registry, the way 20260924000000 registered
-- the dosha test: an `assessment` under the same founder profile that signs
-- way21, linked from the executor (test_definitions) to the thing.
with founder as (
  select c.author_profile_id as id
    from public.lms_courses c
   where c.slug = 'way21' and c.author_profile_id is not null
   limit 1
)
insert into public.experiences (kind, slug, author_profile_id, listed, title)
values ('assessment', 'balance-test', (select id from founder), true, 'Тест балансу дош')
on conflict (slug) do nothing;

update public.test_definitions t
   set experience_id = e.id
  from public.experiences e
 where t.slug = 'balance-test' and e.slug = 'balance-test' and t.experience_id is null;
