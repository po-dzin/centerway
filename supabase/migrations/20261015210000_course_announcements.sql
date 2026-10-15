-- ОГОЛОШЕННЯ АВТОРА УЧНЯМ КУРСУ (L1) и общие оповещения ученика (2026-10-15).
--
-- Зачем. У автора не было канала к своим ученикам (docs/author-learner-contact-
-- 2026-09-09.md, ступень L1): одна заметка на курс, всем с открытым доступом,
-- в одну сторону, без ответов и без чьих-либо имён у автора. G одобрил макет
-- 15.10 (https://claude.ai/artifact/QUbXwp4eS53Enz9zYyDE8X).
--
--   1. `lms_announcements` — то, что автор написал: одна строка на объявление.
--   2. `learner_notices` — то, что получил КАЖДЫЙ ученик: строка на человека.
--      Её читают курс (блок «Від автора»), Бібліотека (метка «Нове від автора»)
--      и отправка в Telegram (`tg_status`). Отметка `read_at` ставится, когда
--      ученик открыл курс, — и туда же ведёт кнопка в Telegram, поэтому одно
--      и то же не всплывает дважды. Telegram не сообщает боту о прочтении, так
--      что переход — единственная честная синхронизация.
--      `kind` открыт для других источников (старт потока и т. п.): будущий
--      колокольчик — это просто выборка по этим строкам.
--
-- Откат: drop table if exists public.learner_notices; drop table if exists public.lms_announcements;

begin;

create table if not exists public.lms_announcements (
  id           uuid        primary key default gen_random_uuid(),
  course_id    uuid        not null references public.lms_courses (id) on delete cascade,
  author_id    uuid        null references public.lms_authors (id) on delete set null,
  created_by   uuid        not null,
  body         text        not null,
  lesson_slug  text        null,
  recipients   integer     not null default 0,
  created_at   timestamptz not null default now(),
  hidden_at    timestamptz null,
  constraint lms_announcements_body_length check (char_length(btrim(body)) between 1 and 1000)
);

comment on table public.lms_announcements is
  'Оголошення автора учням курсу (L1). Одне на курс на добу; адмін може сховати (hidden_at).';

create index if not exists idx_lms_announcements_course on public.lms_announcements (course_id, created_at desc);

create table if not exists public.learner_notices (
  id               uuid        primary key default gen_random_uuid(),
  auth_user_id     uuid        not null,
  kind             text        not null,
  announcement_id  uuid        null references public.lms_announcements (id) on delete cascade,
  course_id        uuid        null references public.lms_courses (id) on delete cascade,
  created_at       timestamptz not null default now(),
  tg_status        text        not null default 'pending',
  tg_sent_at       timestamptz null,
  read_at          timestamptz null,
  constraint learner_notices_kind_known check (kind in ('author_announcement')),
  constraint learner_notices_tg_status_known check (tg_status in ('pending', 'sending', 'sent', 'unreachable', 'failed')),
  constraint learner_notices_one_per_person unique (announcement_id, auth_user_id)
);

comment on table public.learner_notices is
  'Оповещение одного ученика: что пришло, ушло ли в Telegram, прочитано ли на платформе.';

create index if not exists idx_learner_notices_user on public.learner_notices (auth_user_id, created_at desc);
create index if not exists idx_learner_notices_unread on public.learner_notices (auth_user_id, course_id) where read_at is null;
create index if not exists idx_learner_notices_pending on public.learner_notices (announcement_id) where tg_status in ('pending', 'sending');

alter table public.lms_announcements enable row level security;
alter table public.learner_notices enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'lms_announcements' and policyname = 'lms_announcements_admin_all') then
    create policy lms_announcements_admin_all on public.lms_announcements
      for all using (public.get_my_role() = 'admin') with check (public.get_my_role() = 'admin');
  end if;
  if not exists (select 1 from pg_policies where tablename = 'learner_notices' and policyname = 'learner_notices_own_read') then
    create policy learner_notices_own_read on public.learner_notices
      for select using (auth.uid() = auth_user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'learner_notices' and policyname = 'learner_notices_admin_all') then
    create policy learner_notices_admin_all on public.learner_notices
      for all using (public.get_my_role() = 'admin') with check (public.get_my_role() = 'admin');
  end if;
end $$;

grant all on public.lms_announcements to service_role;
grant all on public.learner_notices to service_role;

commit;
