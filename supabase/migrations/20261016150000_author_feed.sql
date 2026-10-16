-- СТРІЧКА: дописи авторів, реакції, коментарі, позначки в журнал (2026-10-16).
--
-- Зачем. G утвердил ленту 16.10 (https://claude.ai/artifact/1ntoi3FtLYCqxA9kSRYuB5):
-- одна общая лента всех авторов, пишут только авторы, со страницы ленты, с
-- блоками из своих программ; у ученика — реакции из нашего набора эмодзи,
-- комментарии и выделение текста в журнал. Ручной проверки нет: каждый допис
-- и комментарий проходит автопроверку, задержанное уходит в рабочую группу
-- Telegram с кнопками «Опублікувати» / «Повернути».
--
--   1. `feed_posts` — допис. `status` — его путь: checking → published, или
--      checking → held → published | returned. `topic` — одна из восьми
--      категорий каталога, автор выбирает сам. Блок программы — ссылка на
--      курс/урок/блок плюс `block_display` (целиком или уривком); текст блока
--      читается из урока при показе, не копируется.
--   2. `feed_reactions` — одна строка на (допис, человек, эмодзи). Набор —
--      `src/lib/brand/emojiSet.ts`; проверка значения — в коде, не в схеме,
--      чтобы новый эмодзи не требовал миграции.
--   3. `feed_comments` — комментарий, ответы в один уровень (`parent_id`
--      только на комментарий верхнего уровня; это держит код).
--   4. `feed_marks` — «Позначити» / «Нотатка» на дописе (выделение; нотатка — поле
--      `note` той же строки, как в `lms_annotations`). Журнал ученика
--      читает и `lms_annotations`, и эту таблицу: у позначки на дописе нет
--      записи на курс и урока, поэтому это не строка `lms_annotations`.
--
-- RLS — защита в глубину, как везде (AGENTS.md → Database Rule): сервер
-- ходит сервисной ролью, права проверяет TypeScript.
--
-- Откат:
--   drop table if exists public.feed_marks;
--   drop table if exists public.feed_comments;
--   drop table if exists public.feed_reactions;
--   drop table if exists public.feed_posts;

begin;

create table if not exists public.feed_posts (
  id               uuid        primary key default gen_random_uuid(),
  author_id        uuid        not null references public.lms_authors (id) on delete cascade,
  created_by       uuid        not null,
  body             text        not null,
  topic            text        not null,
  photo_path       text        null,
  photo_alt        text        null,
  course_id        uuid        null references public.lms_courses (id) on delete set null,
  lesson_id        uuid        null references public.lms_lessons (id) on delete set null,
  block_id         text        null,
  block_display    text        not null default 'excerpt',
  status           text        not null default 'checking',
  gate             jsonb       null,
  held_reason      text        null,
  returned_reason  text        null,
  tg_message_id    bigint      null,
  decided_by       text        null,
  published_at     timestamptz null,
  hidden_at        timestamptz null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint feed_posts_body_length check (char_length(btrim(body)) between 1 and 4000),
  constraint feed_posts_topic_known check (topic in ('movement', 'nutrition', 'cleansing', 'breathing', 'meditation', 'focus', 'energy', 'relaxation')),
  constraint feed_posts_status_known check (status in ('checking', 'published', 'held', 'returned')),
  constraint feed_posts_block_display_known check (block_display in ('full', 'excerpt')),
  constraint feed_posts_block_needs_lesson check (block_id is null or lesson_id is not null),
  constraint feed_posts_published_has_time check (status <> 'published' or published_at is not null)
);

comment on table public.feed_posts is
  'Допис автора у «Стрічці». status: checking → published | held → published | returned.';

create index if not exists idx_feed_posts_public on public.feed_posts (published_at desc) where status = 'published' and hidden_at is null;
create index if not exists idx_feed_posts_author on public.feed_posts (author_id, created_at desc);
create index if not exists idx_feed_posts_held on public.feed_posts (created_at) where status = 'held';

create table if not exists public.feed_reactions (
  post_id       uuid        not null references public.feed_posts (id) on delete cascade,
  auth_user_id  uuid        not null,
  emoji         text        not null,
  created_at    timestamptz not null default now(),
  primary key (post_id, auth_user_id, emoji),
  constraint feed_reactions_emoji_shape check (emoji ~ '^[a-z0-9-]{1,32}$')
);

create index if not exists idx_feed_reactions_user on public.feed_reactions (auth_user_id, created_at desc);

create table if not exists public.feed_comments (
  id            uuid        primary key default gen_random_uuid(),
  post_id       uuid        not null references public.feed_posts (id) on delete cascade,
  parent_id     uuid        null references public.feed_comments (id) on delete cascade,
  auth_user_id  uuid        not null,
  body          text        not null,
  status        text        not null default 'published',
  gate          jsonb       null,
  hidden_at     timestamptz null,
  hidden_by     uuid        null,
  created_at    timestamptz not null default now(),
  constraint feed_comments_body_length check (char_length(btrim(body)) between 1 and 1000),
  constraint feed_comments_status_known check (status in ('published', 'held'))
);

create index if not exists idx_feed_comments_post on public.feed_comments (post_id, created_at);
create index if not exists idx_feed_comments_held on public.feed_comments (created_at) where status = 'held';

create table if not exists public.feed_marks (
  id            uuid        primary key default gen_random_uuid(),
  auth_user_id  uuid        not null,
  post_id       uuid        not null references public.feed_posts (id) on delete cascade,
  client_id     text        not null,
  kind          text        not null default 'highlight',
  start_offset  integer     null,
  end_offset    integer     null,
  quote         text        null,
  prefix        text        null,
  note          text        null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint feed_marks_kind_known check (kind = 'highlight'),
  constraint feed_marks_one_per_client unique (auth_user_id, client_id)
);

comment on table public.feed_marks is
  'Позначка або нотатка учня на дописі. Приватна: лише свої, без читання персоналом.';

create index if not exists idx_feed_marks_user on public.feed_marks (auth_user_id, created_at desc);

alter table public.feed_posts enable row level security;
alter table public.feed_reactions enable row level security;
alter table public.feed_comments enable row level security;
alter table public.feed_marks enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'feed_posts' and policyname = 'feed_posts_public_read') then
    create policy feed_posts_public_read on public.feed_posts
      for select using (status = 'published' and hidden_at is null);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'feed_posts' and policyname = 'feed_posts_admin_all') then
    create policy feed_posts_admin_all on public.feed_posts
      for all using (public.get_my_role() = 'admin') with check (public.get_my_role() = 'admin');
  end if;
  if not exists (select 1 from pg_policies where tablename = 'feed_reactions' and policyname = 'feed_reactions_public_read') then
    create policy feed_reactions_public_read on public.feed_reactions for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'feed_reactions' and policyname = 'feed_reactions_own_write') then
    create policy feed_reactions_own_write on public.feed_reactions
      for all using (auth.uid() = auth_user_id) with check (auth.uid() = auth_user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'feed_comments' and policyname = 'feed_comments_public_read') then
    create policy feed_comments_public_read on public.feed_comments
      for select using (status = 'published' and hidden_at is null);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'feed_comments' and policyname = 'feed_comments_admin_all') then
    create policy feed_comments_admin_all on public.feed_comments
      for all using (public.get_my_role() = 'admin') with check (public.get_my_role() = 'admin');
  end if;
  if not exists (select 1 from pg_policies where tablename = 'feed_marks' and policyname = 'feed_marks_own_all') then
    create policy feed_marks_own_all on public.feed_marks
      for all using (auth.uid() = auth_user_id) with check (auth.uid() = auth_user_id);
  end if;
end $$;

grant all on public.feed_posts to service_role;
grant all on public.feed_reactions to service_role;
grant all on public.feed_comments to service_role;
grant all on public.feed_marks to service_role;

commit;
