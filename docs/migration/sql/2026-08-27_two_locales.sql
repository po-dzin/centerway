-- CenterWay: two content locales, and only two — uk and en.
-- Run in Supabase SQL editor (public schema).
-- Contract: src/lms-core/course.ts (`CourseLocale`)
--
-- WHY. `2026-08-15_lms_foundation.sql` opened `lms_courses.locale` to
-- ('uk', 'ru', 'en') on the assumption recorded in the audit doc: three locales
-- everywhere. That assumption is withdrawn — the surfaces ship uk + en, the
-- admin panel was translated off ru, and `CourseLocale` in the app no longer
-- accepts 'ru'. A CHECK that still admits a value the reader rejects is a row
-- the app cannot load: the database must refuse it at write time instead.
--
-- Nothing to backfill — every course row ships 'uk' (data/courses/*.json). The
-- guard below fails loudly rather than silently rewriting anyone's content if
-- that turns out to be false in this environment.

do $$
declare
  stray integer;
begin
  select count(*) into stray from public.lms_courses where locale = 'ru';
  if stray > 0 then
    raise exception 'lms_courses has % row(s) with locale=ru — translate or relocale them before narrowing the CHECK', stray;
  end if;
end $$;

alter table public.lms_courses
  drop constraint if exists lms_courses_locale_check;

alter table public.lms_courses
  add constraint lms_courses_locale_check check (locale in ('uk', 'en'));
