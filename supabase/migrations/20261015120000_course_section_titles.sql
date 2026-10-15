-- 2026-10-15 · Program-page block titles written per course
--
-- G (15.10): the headings of a program page («Що дає цей короткий вхід», «Для
-- кого», «Що зміниться») were the same on every program because they came from
-- the course's kind. Each program now carries its own titles, and only the small
-- line above each block stays shared. Stored as one jsonb object with the keys
-- method, shape, audience, results, included (src/lms-core/course.ts,
-- COURSE_SECTION_TITLE_KEYS). Null = the page prints the generic titles, as it
-- always did.
--
-- The four drafts below are the ones G approved on the 2026-10-15 mockup. They
-- only fill a course that has no titles yet, so re-running or a later edit in
-- the builder is never overwritten.
--
-- ROLLBACK:
--   alter table public.lms_courses drop column if exists section_titles;

alter table public.lms_courses
  add column if not exists section_titles jsonb null;

update public.lms_courses set section_titles = jsonb_build_object(
  'method', 'Десять хвилин, що повертають тіло',
  'shape', 'Десять хвилин на день',
  'audience', 'Якщо тіло тримає напругу',
  'results', 'Що відчуєте за перший тиждень',
  'included', 'Шість відео і п''ятнадцять вправ'
) where slug = 'short' and section_titles is null;

update public.lms_courses set section_titles = jsonb_build_object(
  'method', 'Очищення, після якого звички лишаються',
  'shape', 'Три фази за двадцять один день',
  'audience', 'Якщо «чистки» не трималися',
  'results', 'Що зміниться за двадцять один день',
  'included', 'Фітопротокол, режим і вебінари'
) where slug = 'way21' and section_titles is null;

update public.lms_courses set section_titles = jsonb_build_object(
  'method', 'Один м''який крок замість дієти',
  'shape', 'Три дні у вашому темпі',
  'audience', 'Якщо заїдаєте стрес',
  'results', 'Що повернеться вже за день',
  'included', 'Стратегія, чек-лист і дихання'
) where slug = 'reset-day' and section_titles is null;

update public.lms_courses set section_titles = jsonb_build_object(
  'method', 'Своя конституція замість чужої дієти',
  'shape', 'Двадцять один урок по порядку',
  'audience', 'Якщо хочете зрозуміти себе',
  'results', 'Що ви навчитеся бачити',
  'included', 'Двадцять один урок і рецепти'
) where slug = 'natural-body' and section_titles is null;
