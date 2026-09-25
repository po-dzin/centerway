-- linked_program_modules: Reset Day и Short внутри Шляху 21 и «Природного тіла»
-- 25.09.2026
--
-- ОТДЕЛЬНО ОТ 20260925000000_offer_formats И ПОСЛЕ ДЕПЛОЯ, намеренно. Модуль-
-- ссылка — модуль без уроков. Код, который старше `linkedCourseSlug`, валидирует
-- такой курс как битый (`lms_module_empty_lessons`), и витрина молча убирает
-- его с полки. Применённая раньше кода, эта миграция сняла бы Шлях 21 с продажи
-- до конца деплоя. Колонку `linked_course_slug` добавляет 20260925000000;
-- здесь только строки.
--
-- ОТКАТ: delete from public.lms_modules where linked_course_slug is not null;

-- Модули-ссылки в конце материалов. id те же, что в data/courses/*.json, чтобы
-- сид и база не разошлись. Открывает их право на вложенную программу, а не на
-- родительскую: самостоятельный формат видит их закрытыми.
begin;

insert into public.lms_modules (id, course_id, slug, title, "order", reference, linked_course_slug)
select v.id::uuid, c.id, v.slug, v.title, v.ord, true, v.linked
  from (values
    ('way21',        'c4a91d3e-0000-4000-8000-000000000016', 'reset-day', 'Розвантажувальний день', 6, 'reset-day'),
    ('way21',        'c4a91d3e-0000-4000-8000-000000000017', 'short',     'Short-Перезавантаження', 7, 'short'),
    ('natural-body', '4f2b8c1e-7a3d-5e90-b6c4-2d1e8f0a9b31', 'reset-day', 'Розвантажувальний день', 6, 'reset-day'),
    ('natural-body', '4f2b8c1e-7a3d-5e90-b6c4-2d1e8f0a9b32', 'short',     'Short-Перезавантаження', 7, 'short')
  ) as v(course, id, slug, title, ord, linked)
  join public.lms_courses c on c.slug = v.course
on conflict (id) do nothing;

commit;
