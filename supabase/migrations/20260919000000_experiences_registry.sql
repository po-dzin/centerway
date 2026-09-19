-- experiences: один реестр всего, что платформа продаёт, даёт и делает
-- 19.09.2026
--
-- ЗАЧЕМ. На 17.09 «вещь» жила в пяти хранилищах: константа `PRODUCTS`,
-- `lms_course_offers`, `product_offers`, сами `lms_courses` и реестр воронок в
-- `surfaces/catalog.ts`. Консультация, пакет супровода, `irem-individual`,
-- травы и тест доши не были строкой нигде: у них не было ни автора, ни адреса
-- по общему правилу, и каждое новое такое «нечто» стоило правки кода. Инвентарь
-- и решение — `docs/experiences-unification-2026-09-17.md`.
--
-- ЧТО ЭТО. Узкий реестр: что это (`kind`), где живёт (`slug`), чьё
-- (`author_profile_id`), стоит ли на полке (`listed`). И всё.
--
-- ЧЕГО ЗДЕСЬ НАМЕРЕННО НЕТ — карточки курса. Заголовок, обложка, статус,
-- видимость и review остаются на `lms_courses`: там они под ревизиями и
-- `publishedEditPolicy`. Перенос заголовка сюда вывел бы его из-под ревью, а
-- «один статус вместо трёх» стал бы тремя полями плюс синхронизация — тот же
-- класс бага, что «витрина молча теряет курсы». `title`/`summary`/`cover` в
-- этой таблице заполняются ТОЛЬКО у вещей без курса (CHECK ниже это держит).
--
-- КТО ПИШЕТ СТРОКУ КУРСА. Триггер, и только он. Для kind course|mini|checklist
-- строка реестра — проекция `lms_courses`: slug = program_slug, kind = kind
-- курса, автор = author_profile_id, listed = (published AND listed) хотя бы у
-- одной локали. Второго писателя в коде нет и быть не должно: билдер, админка
-- и импорт пишут в `lms_courses`, как писали, а реестр следует за ними. Поэтому
-- этот шаг не трогает ни одной строки TypeScript.
--
-- ОДНА ВЕЩЬ — НЕСКОЛЬКО ЛОКАЛЕЙ. `program_slug` не уникален: uk- и en-версии
-- одного курса делят адрес. Поэтому связь `lms_courses → experiences`
-- многие-к-одному, а проекция считается по всем привязанным курсам.
--
-- ССЫЛКА ВСЕГДА ОТ ИСПОЛНИТЕЛЯ К ВЕЩИ: `lms_courses.experience_id`,
-- `test_definitions.experience_id`. В одну сторону, чтобы инвариант «у курса
-- есть вещь» был NOT NULL в базе, а не договорённостью.
--
-- ИМЕНА. `experience_aliases` — любое старое имя или хост находит вещь: для
-- редиректов, воронок и отчётов. Коды чекаута сюда НЕ попадают: при нескольких
-- офферах на вещь код, указывающий на вещь, неоднозначен. Коды получат свою
-- таблицу `offer_aliases` вместе с `experience_offers` (следующая миграция).
-- При смене `program_slug` старый адрес сам становится алиасом.
--
-- ОТКАТ:
--   drop trigger lms_courses_experience_link on public.lms_courses;
--   drop trigger lms_courses_experience_sync on public.lms_courses;
--   alter table public.lms_courses drop column experience_id;
--   alter table public.test_definitions drop column experience_id;
--   drop table public.experience_aliases; drop table public.experiences;
--   drop function public.experience_link_course(), public.experience_sync_course(),
--                 public.experience_refresh(uuid), public.experiences_touch_updated_at();

begin;

-- ─────────────────────────────────────────
-- 1. Реестр
-- ─────────────────────────────────────────
create table if not exists public.experiences (
  id                 uuid primary key default gen_random_uuid(),
  kind               text        not null,
  slug               text        not null unique,
  author_profile_id  uuid        null references public.lms_authors (id) on delete set null,
  listed             boolean     not null default false,
  sort_order         integer     null,
  -- Только для вещей без курса. У курса эти три поля — на lms_courses.
  title              text        null,
  summary            text        null,
  cover              jsonb       null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint experiences_kind_known
    check (kind in ('course', 'mini', 'checklist', 'consultation', 'package', 'assessment', 'physical')),
  constraint experiences_slug_shape
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- Карточка курса живёт на курсе. Вещь без курса обязана назвать себя сама.
  constraint experiences_card_only_without_course
    check (
      (kind in ('course', 'mini', 'checklist') and title is null and summary is null and cover is null)
      or (kind not in ('course', 'mini', 'checklist') and title is not null)
    )
);

comment on table public.experiences is
  'Реестр всего, что можно купить, получить или заказать у человека. Для курсов — проекция lms_courses, которую ведёт триггер.';
comment on column public.experiences.slug is
  'Единственный публичный адрес вещи. У курса равен lms_courses.program_slug.';
comment on column public.experiences.listed is
  'Стоит ли на полке. У курса: published AND visibility=listed хотя бы у одной локали.';

create index if not exists idx_experiences_author on public.experiences (author_profile_id);
create index if not exists idx_experiences_shelf on public.experiences (kind, sort_order) where listed;

create or replace function public.experiences_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists experiences_touch on public.experiences;
create trigger experiences_touch
  before update on public.experiences
  for each row execute function public.experiences_touch_updated_at();

-- ─────────────────────────────────────────
-- 2. Имена
-- ─────────────────────────────────────────
create table if not exists public.experience_aliases (
  alias          text primary key,
  experience_id  uuid not null references public.experiences (id) on delete cascade,
  kind           text not null default 'slug',
  created_at     timestamptz not null default now(),

  constraint experience_aliases_kind_known check (kind in ('slug', 'host')),
  constraint experience_aliases_lowercase check (alias = lower(alias))
);

comment on table public.experience_aliases is
  'Старые адреса и хосты вещи. Коды чекаута — в offer_aliases, не здесь.';

create index if not exists idx_experience_aliases_experience on public.experience_aliases (experience_id);

-- ─────────────────────────────────────────
-- 3. Права
-- ─────────────────────────────────────────
-- Читать полку может любой; писать — только admin. Автор пишет курс, а строка
-- реестра следует за курсом через триггер (SECURITY DEFINER ниже).
alter table public.experiences enable row level security;
alter table public.experience_aliases enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'experiences' and policyname = 'experiences_public_read') then
    execute $p$ create policy "experiences_public_read" on public.experiences for select using (listed) $p$;
  end if;
  if not exists (select 1 from pg_policies where tablename = 'experiences' and policyname = 'experiences_admin_all') then
    execute $p$
      create policy "experiences_admin_all" on public.experiences
        for all using (public.get_my_role() = 'admin') with check (public.get_my_role() = 'admin')
    $p$;
  end if;
  if not exists (select 1 from pg_policies where tablename = 'experience_aliases' and policyname = 'experience_aliases_public_read') then
    execute $p$ create policy "experience_aliases_public_read" on public.experience_aliases for select using (true) $p$;
  end if;
  if not exists (select 1 from pg_policies where tablename = 'experience_aliases' and policyname = 'experience_aliases_admin_all') then
    execute $p$
      create policy "experience_aliases_admin_all" on public.experience_aliases
        for all using (public.get_my_role() = 'admin') with check (public.get_my_role() = 'admin')
    $p$;
  end if;
end $$;

grant select on public.experiences, public.experience_aliases to anon, authenticated;
grant all on public.experiences, public.experience_aliases to service_role;

-- ─────────────────────────────────────────
-- 4. Ссылки от исполнителей
-- ─────────────────────────────────────────
alter table public.lms_courses
  add column if not exists experience_id uuid null references public.experiences (id) on delete restrict;
alter table public.test_definitions
  add column if not exists experience_id uuid null references public.experiences (id) on delete set null;

create index if not exists idx_lms_courses_experience on public.lms_courses (experience_id);

-- ─────────────────────────────────────────
-- 5. Проекция курса в реестр
-- ─────────────────────────────────────────
-- Пересчитать строку реестра по всем привязанным курсам (локалям).
create or replace function public.experience_refresh(target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  projected record;
begin
  select
    -- Формат говорит автор; у черновика без формата — 'course', как читает витрина.
    coalesce(min(c.kind) filter (where c.kind is not null), 'course')      as kind,
    (array_agg(c.author_profile_id order by c.created_at)
       filter (where c.author_profile_id is not null))[1]                  as author_profile_id,
    coalesce(bool_or(c.status = 'published' and c.visibility = 'listed'), false) as listed,
    min(c.sort_order)                                                       as sort_order
  into projected
  from public.lms_courses c
  where c.experience_id = target;

  update public.experiences e
     set kind = projected.kind,
         author_profile_id = projected.author_profile_id,
         listed = projected.listed,
         sort_order = projected.sort_order
   where e.id = target
     and e.kind in ('course', 'mini', 'checklist')
     and (e.kind, e.author_profile_id, e.listed, e.sort_order)
         is distinct from
         (projected.kind, projected.author_profile_id, projected.listed, projected.sort_order);
end $$;

-- BEFORE INSERT/UPDATE: у курса всегда есть вещь с его адресом.
create or replace function public.experience_link_course()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  found_id uuid;
  found_kind text;
  siblings integer;
begin
  if tg_op = 'UPDATE' and new.program_slug is not distinct from old.program_slug and new.experience_id is not null then
    return new;
  end if;

  -- Курс переехал на новый адрес. Если он у вещи один — переезжает вещь, а
  -- старый адрес остаётся алиасом: ссылка из поста не должна стать 404.
  if tg_op = 'UPDATE' and new.experience_id is not null then
    select count(*) into siblings
      from public.lms_courses c
     where c.experience_id = new.experience_id and c.id <> new.id;
    if siblings = 0 and not exists (select 1 from public.experiences e where e.slug = new.program_slug) then
      update public.experiences set slug = new.program_slug where id = new.experience_id;
      delete from public.experience_aliases where alias = lower(new.program_slug);
      insert into public.experience_aliases (alias, experience_id, kind)
      values (lower(old.program_slug), new.experience_id, 'slug')
      on conflict (alias) do update set experience_id = excluded.experience_id;
      return new;
    end if;
  end if;

  select e.id, e.kind into found_id, found_kind
    from public.experiences e where e.slug = new.program_slug;

  if found_id is not null and found_kind not in ('course', 'mini', 'checklist') then
    raise exception 'experience_slug_taken: % is a % and cannot be a course address', new.program_slug, found_kind
      using errcode = '23505';
  end if;

  if found_id is null then
    insert into public.experiences (kind, slug, author_profile_id, listed, sort_order)
    values (
      coalesce(new.kind, 'course'),
      new.program_slug,
      new.author_profile_id,
      new.status = 'published' and new.visibility = 'listed',
      new.sort_order
    )
    returning id into found_id;
    -- Адрес, который был чьим-то алиасом, теперь занят настоящей вещью.
    delete from public.experience_aliases where alias = lower(new.program_slug);
  end if;

  new.experience_id := found_id;
  return new;
end $$;

-- AFTER: пересчитать проекцию у затронутых вещей; осиротевшую вещь курса убрать.
create or replace function public.experience_sync_course()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('INSERT', 'UPDATE') and new.experience_id is not null then
    perform public.experience_refresh(new.experience_id);
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.experience_id is not null
     and (tg_op = 'DELETE' or old.experience_id is distinct from new.experience_id) then
    if exists (select 1 from public.lms_courses c where c.experience_id = old.experience_id) then
      perform public.experience_refresh(old.experience_id);
    else
      -- Курс удалён вместе со своей вещью — если на неё ещё ничего не ссылается.
      begin
        delete from public.experiences e
         where e.id = old.experience_id and e.kind in ('course', 'mini', 'checklist');
      exception when foreign_key_violation then
        update public.experiences set listed = false where id = old.experience_id;
      end;
    end if;
  end if;
  return null;
end $$;

-- ─────────────────────────────────────────
-- 6. Backfill: курсы
-- ─────────────────────────────────────────
insert into public.experiences (kind, slug, author_profile_id, listed, sort_order)
select
  coalesce(min(c.kind) filter (where c.kind is not null), 'course'),
  c.program_slug,
  (array_agg(c.author_profile_id order by c.created_at) filter (where c.author_profile_id is not null))[1],
  coalesce(bool_or(c.status = 'published' and c.visibility = 'listed'), false),
  min(c.sort_order)
from public.lms_courses c
where c.experience_id is null
group by c.program_slug
on conflict (slug) do nothing;

update public.lms_courses c
   set experience_id = e.id
  from public.experiences e
 where c.experience_id is null
   and e.slug = c.program_slug
   and e.kind in ('course', 'mini', 'checklist');

alter table public.lms_courses alter column experience_id set not null;

-- Триггеры — после backfill, чтобы он не гонял их по каждой строке.
drop trigger if exists lms_courses_experience_link on public.lms_courses;
create trigger lms_courses_experience_link
  before insert or update of program_slug, experience_id on public.lms_courses
  for each row execute function public.experience_link_course();

drop trigger if exists lms_courses_experience_sync on public.lms_courses;
create trigger lms_courses_experience_sync
  -- program_slug здесь потому, что `UPDATE OF` смотрит на SET-список запроса, а не
  -- на то, что BEFORE-триггер поменял в строке: смена адреса меняет experience_id.
  after insert or delete or update of kind, author_profile_id, status, visibility, sort_order, experience_id, program_slug
  on public.lms_courses
  for each row execute function public.experience_sync_course();

-- ─────────────────────────────────────────
-- 7. Backfill: вещи без курса
-- ─────────────────────────────────────────
-- Перенос того, что уже продаётся или раздаётся, а не новый ассортимент.
-- Автор — тот же профиль, что подписывает way21: консультацию, супровід, збір
-- і тест веде він. У irem-individual автора в базе нет (как и у курса irem).
with founder as (
  select c.author_profile_id as id
    from public.lms_courses c
   where c.slug = 'way21' and c.author_profile_id is not null
   limit 1
)
insert into public.experiences (kind, slug, author_profile_id, listed, title)
values
  ('consultation', 'consult',         (select id from founder), true,  'Особиста консультація'),
  ('package',      'way21-support',   (select id from founder), false, 'Шлях 21 — індивідуальний супровід'),
  ('package',      'irem-individual', null,                     false, 'IREM — індивідуально'),
  ('physical',     'herbs',           (select id from founder), true,  'Травʼяний збір'),
  ('assessment',   'dosha-test',      (select id from founder), true,  'Тест доші')
on conflict (slug) do nothing;

update public.test_definitions t
   set experience_id = e.id
  from public.experiences e
 where t.slug = 'dosha-test' and e.slug = 'dosha-test' and t.experience_id is null;

-- ─────────────────────────────────────────
-- 8. Backfill: старые адреса и хосты
-- ─────────────────────────────────────────
-- Источники: normalizeProduct (src/lib/products.ts), рукописные 308 в
-- programs/[slug] и реестр хостов в surfaces/catalog.ts. Только имена; коды
-- чекаута уйдут в offer_aliases. Алиас, совпавший с живым адресом, пропускается.
insert into public.experience_aliases (alias, experience_id, kind)
select a.alias, e.id, a.kind
from (values
  ('short',            'reboot',            'slug'),
  ('irem-gymnastics',  'irem',              'slug'),
  ('ivem-gimnastika',  'irem',              'slug'),
  ('detox',            'way21',             'slug'),
  ('detox21',          'way21',             'slug'),
  ('shlyah21',         'way21',             'slug'),
  ('mini-detox',       'reset-day',         'slug'),
  ('resetday',         'reset-day',         'slug'),
  ('rozvantazhennya',  'reset-day',         'slug'),
  ('ideal-body',       'natural-body',      'slug'),
  ('idealne-tilo',     'natural-body',      'slug'),
  ('novyi-kurs-5',     'soul-daily-ritual', 'slug'),
  ('consultation',     'consult',           'slug'),
  ('dosha',            'dosha-test',        'slug'),
  ('reboot.centerway.net.ua',   'reboot',     'host'),
  ('irem.centerway.net.ua',     'irem',       'host'),
  ('way21.centerway.net.ua',    'way21',      'host'),
  ('resetday.centerway.net.ua', 'reset-day',  'host'),
  ('herbs.centerway.net.ua',    'herbs',      'host'),
  ('consult.centerway.net.ua',  'consult',    'host'),
  ('dosha.centerway.net.ua',    'dosha-test', 'host')
) as a(alias, slug, kind)
join public.experiences e on e.slug = a.slug
where not exists (select 1 from public.experiences taken where taken.slug = a.alias)
on conflict (alias) do nothing;

commit;

-- ПРОВЕРКА:
-- select kind, slug, listed, author_profile_id is not null as has_author from experiences order by kind, slug;
-- select count(*) from lms_courses where experience_id is null;            -- 0
-- select alias, kind, (select slug from experiences e where e.id = experience_id) from experience_aliases order by 2, 1;
