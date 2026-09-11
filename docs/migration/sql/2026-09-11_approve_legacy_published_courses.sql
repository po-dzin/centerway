-- Затвердити два курси, які бэкфіл 23.08 не застав
-- 11.09.2026
--
-- ЧТО ЧИНИТ. `short` и `irem-gymnastics` стоят published + listed, продаются и
-- имеют `review_status = 'draft'`, `approved_at = NULL`. Панель каталога
-- печатала над ними «Не продається: не затверджений», хотя путь покупки
-- `review_status` не читает вовсе (`isPublicCourse` в
-- `src/lib/platform/offers.ts` спрашивает status и visibility, дальше оффер).
--
-- ОТКУДА ВЗЯЛОСЬ. Миграция 2026-08-23_lms_course_review.sql добавила колонку с
-- `DEFAULT 'draft'` и разово подняла published → approved. Обе строки созданы
-- ПОСЛЕ этого прохода (irem 23.08 в 20:30, short 26.08) импортом, который писал
-- `status = 'published'` напрямую, минуя ревью. Фолбэк в коде («колонки нет →
-- считаем approved») спасает только NULL, а здесь стоит явный 'draft'.
--
-- ПОЧЕМУ ЭТО НЕ ЛЕЧИТСЯ КНОПКОЙ В ПАНЕЛИ — точнее, не лечилось: у обеих строк
-- висит `pending_content` с `pending_review_status = 'draft'`, а старое правило
-- `moderateCourse` не давало одобрить релиз, пока рядом лежит любая ревизия.
-- Это исправлено в коде тем же заходом; миграция закрывает две строки, которые
-- уже в проде.
--
-- ЧЕГО ЭТА МИГРАЦИЯ НЕ ДЕЛАЕТ. Не трогает `pending_content`: черновик автора
-- остаётся черновиком и в продажу не уходит. Не трогает цену и видимость.
-- `approved_by` остаётся NULL — одобрения человеком не было, была ошибка
-- данных, и подписывать её чьим-то id значило бы соврать в аудите.
UPDATE public.lms_courses
SET review_status = 'approved',
    review_note = NULL,
    approved_at = COALESCE(approved_at, now())
WHERE status = 'published'
  AND review_status = 'draft'
  AND slug IN ('short', 'irem-gymnastics');
