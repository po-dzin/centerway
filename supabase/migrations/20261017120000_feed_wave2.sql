-- СТРІЧКА, вторая волна: темы списком, медиа, отметки авторов, «Зберегти»,
-- предел реакций (2026-10-17).
--
-- Зачем. G 17.10 утвердил макет второй волны («собирай все вместе»):
--
--   1. `feed_posts.topics` — у допису от одной до трёх тем каталога (было
--      ровно одна). Колонка `topic` остаётся и всегда равна первой теме
--      (`topic = topics[1]`, проверка в схеме): старый код, читающий `topic`,
--      не ломается, а фильтр ленты ищет по пересечению `topics && …`.
--   2. `feed_posts.media` — фото (до 10, у каждого `path`, `w`, `h`,
--      `spoiler`), одно видео YouTube (`youtubeId`), одно аудио (`path`,
--      `durationSec`, `mime`). Форма проверяется в TypeScript
--      (src/lib/feed/media.ts); здесь — только то, что дёшево: объект,
--      число фото, размер.
--   3. `feed_posts.tagged_author_ids` — «з Ірина Мельник»: до трёх
--      профилей авторов. Внешнего ключа на массив нет; при показе читаются
--      только существующие профили с `listed = true`.
--   4. `feed_posts_body_length` — тело теперь хранит безопасное подмножество
--      markdown (**жирный**, *курсив*, [ссылка](https://…), списки, цитата).
--      Разметка добавляет символы, поэтому схема пускает до 8000; предел
--      видимого текста (4000) держит код.
--   5. «Зберегти» — закладка дописа в «Мій журнал». Журнал уже читает
--      `feed_marks` (src/lib/lms/journal.ts), и у журнала уже есть вид
--      `bookmark` (как закладка на уроке в `lms_annotations`), поэтому
--      закладка — строка `feed_marks` с `kind = 'bookmark'`, не новая
--      таблица. Одна закладка на (человек, допис) — частичный уникальный
--      индекс.
--   6. Реакции: не больше трёх разных эмодзи от одного человека на допис.
--      Код отказывает раньше (`reaction_limit`); триггер — пол под кодом,
--      который кто-то поправит, не подумав. Совет-блокировка на (допис,
--      человек) не даёт двум одновременным нажатиям пройти оба.
--   7. Бакет `feed-media` — фото дописов (после того же конвейера, что и
--      обложки курсов: WebP 1600/640, GIF как есть) и аудио как есть.
--      Отдельный от `course-media`: тот ограничен 5 МБ и картинками, а его
--      уборщик (scripts/media-sweep.mjs) считает сиротой всё, на что не
--      ссылается курс, — фото дописа он бы удалил.
--
-- Аддитивно и повторяемо: каждое изменение защищено `if not exists` или
-- снимается и ставится заново.
--
-- Откат:
--   drop trigger if exists feed_reactions_limit on public.feed_reactions;
--   drop function if exists public.feed_reactions_limit();
--   drop index if exists public.feed_marks_one_bookmark;
--   alter table public.feed_marks drop constraint if exists feed_marks_kind_known;
--   delete from public.feed_marks where kind <> 'highlight';
--   alter table public.feed_marks add constraint feed_marks_kind_known check (kind = 'highlight');
--   alter table public.feed_posts drop constraint if exists feed_posts_topics_known;
--   alter table public.feed_posts drop constraint if exists feed_posts_topic_first;
--   alter table public.feed_posts drop constraint if exists feed_posts_media_shape;
--   alter table public.feed_posts drop constraint if exists feed_posts_tagged_count;
--   alter table public.feed_posts drop column if exists topics, drop column if exists media,
--     drop column if exists tagged_author_ids;
--   (длина тела: вернуть check (char_length(btrim(body)) between 1 and 4000))

begin;

/* ─── 1. Темы ─── */

alter table public.feed_posts add column if not exists topics text[] null;

update public.feed_posts
   set topics = array[topic]
 where topics is null or cardinality(topics) = 0;

alter table public.feed_posts alter column topics set default '{}'::text[];
alter table public.feed_posts alter column topics set not null;

alter table public.feed_posts drop constraint if exists feed_posts_topics_known;
alter table public.feed_posts add constraint feed_posts_topics_known check (
  cardinality(topics) between 1 and 3
  and topics <@ array['movement', 'nutrition', 'cleansing', 'breathing', 'meditation', 'focus', 'energy', 'relaxation']::text[]
);

alter table public.feed_posts drop constraint if exists feed_posts_topic_first;
alter table public.feed_posts add constraint feed_posts_topic_first check (topic = topics[1]);

create index if not exists idx_feed_posts_topics on public.feed_posts using gin (topics);

/* ─── 2. Медиа ─── */

alter table public.feed_posts add column if not exists media jsonb not null default '{}'::jsonb;

alter table public.feed_posts drop constraint if exists feed_posts_media_shape;
alter table public.feed_posts add constraint feed_posts_media_shape check (
  jsonb_typeof(media) = 'object'
  and pg_column_size(media) <= 16384
  and (
    not (media ? 'photos')
    or (jsonb_typeof(media -> 'photos') = 'array' and jsonb_array_length(media -> 'photos') <= 10)
  )
  and (not (media ? 'video') or jsonb_typeof(media -> 'video') in ('object', 'null'))
  and (not (media ? 'audio') or jsonb_typeof(media -> 'audio') in ('object', 'null'))
);

/* ─── 3. Отмеченные авторы ─── */

alter table public.feed_posts add column if not exists tagged_author_ids uuid[] not null default '{}'::uuid[];

alter table public.feed_posts drop constraint if exists feed_posts_tagged_count;
alter table public.feed_posts add constraint feed_posts_tagged_count check (cardinality(tagged_author_ids) <= 3);

/* ─── 4. Длина тела с разметкой ─── */

alter table public.feed_posts drop constraint if exists feed_posts_body_length;
alter table public.feed_posts add constraint feed_posts_body_length check (char_length(btrim(body)) between 1 and 8000);

comment on column public.feed_posts.topics is
  'Одна–три темы каталога. topic = topics[1] (для старого кода).';
comment on column public.feed_posts.media is
  'Фото (до 10), видео YouTube, аудио. Форма — src/lib/feed/media.ts.';
comment on column public.feed_posts.tagged_author_ids is
  '«з <автор>»: до трёх профилей lms_authors; показываются только listed.';

/* ─── 5. «Зберегти» → журнал ─── */

alter table public.feed_marks drop constraint if exists feed_marks_kind_known;
alter table public.feed_marks add constraint feed_marks_kind_known check (kind in ('highlight', 'bookmark'));

create unique index if not exists feed_marks_one_bookmark
  on public.feed_marks (auth_user_id, post_id) where kind = 'bookmark';

comment on table public.feed_marks is
  'Позначка, нотатка (highlight) або закладка «Зберегти» (bookmark) учня на дописі. Приватна.';

/* ─── 6. Не больше трёх реакций от человека на допис ─── */

create or replace function public.feed_reactions_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.post_id::text || ':' || new.auth_user_id::text, 0));
  if (
    select count(*) from public.feed_reactions
     where post_id = new.post_id and auth_user_id = new.auth_user_id and emoji <> new.emoji
  ) >= 3 then
    raise exception 'feed_reaction_limit' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists feed_reactions_limit on public.feed_reactions;
create trigger feed_reactions_limit
  before insert on public.feed_reactions
  for each row execute function public.feed_reactions_limit();

/* ─── 7. Бакет для медиа дописов ─── */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'feed-media',
  'feed-media',
  true,
  -- 20 МБ — потолок аудио; фото после конвейера весят сотни килобайт.
  20971520,
  -- Без SVG и без исходных JPEG/PNG: картинка сюда попадает только после
  -- конвейера (WebP) или как анимированный GIF.
  array['image/webp', 'image/gif', 'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists feed_media_public_read on storage.objects;
create policy feed_media_public_read on storage.objects
  for select
  to public
  using (bucket_id = 'feed-media');

commit;
