-- СТРІЧКА: дописи від імені платформи і закріплений допис (2026-10-18).
--
-- Зачем. G 18.10: закріплений допис має бути справжнім дописом, який можна
-- змінити й видалити, а адміни мають писати від імені платформи — з її
-- аватаркою й назвою, не зі своєю.
--
-- 1. `lms_authors` отримує рядок «CenterWay» (slug `centerway`, не listed:
--    сторінки профілю в нього немає, підпис у стрічці не є посиланням). Допис
--    від платформи — це допис цього автора; хто саме з адмінів його написав,
--    лежить у `created_by`.
-- 2. `feed_posts.pinned_at` — закріплений допис. Один на всю стрічку: сервер
--    знімає закріплення з попереднього, коли закріплюють новий.
-- 3. Перший закріплений допис — вступний. Його можна змінити й видалити, як
--    будь-який допис платформи. `created_by` — нульовий uuid: його написала
--    не людина.
--
-- Аддитивно й повторюваний: ні рядок автора, ні вступний допис не дублюються.
--
-- Відкат:
--   delete from public.feed_posts where author_id in (select id from public.lms_authors where slug = 'centerway');
--   delete from public.lms_authors where slug = 'centerway';
--   drop index if exists public.idx_feed_posts_pinned;
--   alter table public.feed_posts drop column if exists pinned_at;

begin;

alter table public.feed_posts add column if not exists pinned_at timestamptz null;

create index if not exists idx_feed_posts_pinned
  on public.feed_posts (pinned_at desc)
  where pinned_at is not null;

insert into public.lms_authors (slug, name, role, photo, listed)
values (
  'centerway',
  'CenterWay',
  'Платформа',
  '{"src": "/cw/brand/cw-icon-192.png", "alt": "CenterWay"}'::jsonb,
  false
)
on conflict (slug) do nothing;

insert into public.feed_posts (
  author_id, created_by, body, topic, topics, status, published_at, pinned_at
)
select
  a.id,
  '00000000-0000-0000-0000-000000000000'::uuid,
  E'Тут автори діляться практиками, думками й подіями.\n\n- **Практики**: вправи для тіла й дихання.\n- **Думки**: спостереження авторів.\n- **Події**: ефіри, старти, зустрічі.',
  'focus',
  array['focus']::text[],
  'published',
  now(),
  now()
from public.lms_authors a
where a.slug = 'centerway'
  and not exists (select 1 from public.feed_posts p where p.author_id = a.id);

commit;
