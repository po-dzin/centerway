-- Точка восстановления автосохранения — пятый и последний вид чекпоинта.
--
-- ЧТО ЗДЕСЬ РЕШАЕТСЯ. Автосохранение в билдере уже есть и пишет рабочую копию
-- примерно раз в полторы секунды. Журнал так писать нельзя: получится по
-- постоянной версии на каждую паузу в наборе, и история, в которой полторы
-- тысячи записей за вечер, ничем не отличается от её отсутствия — найти в ней
-- нужный момент невозможно.
--
-- docs/lms-course-version-history-2026-08-23.md формулирует это так:
-- «coarse recovery point, deduplicated by content hash and retained for a
-- bounded period rather than every autosave request».
--
-- ПОЧЕМУ РЕШЕНИЕ «писать или не писать» ЖИВЁТ В БАЗЕ, А НЕ В КОДЕ. Это
-- инвариант данных, а не поведение одного экрана. Если читать последнюю
-- ревизию из TypeScript и решать там, две открытые вкладки одного автора
-- прочитают одно и то же «последняя была минуту назад» и обе запишут — гонка,
-- которая ломает ровно то свойство, ради которого этот вид существует
-- (редкость). Одна функция, одна транзакция, никакого лишнего round-trip на
-- каждое автосохранение.
--
-- Требует 2026-09-07_lms_course_release_journal.sql (и, до него,
-- 2026-08-23_lms_course_version_history.sql).

CREATE OR REPLACE FUNCTION public.checkpoint_lms_course_autosave(
  p_course_id uuid,
  p_content jsonb,
  p_content_hash text,
  p_created_by uuid DEFAULT NULL,
  p_min_interval interval DEFAULT interval '10 minutes'
)
RETURNS TABLE (id uuid, revision_number bigint, created_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_last_hash text;
  v_last_at timestamptz;
BEGIN
  SELECT r.content_hash, r.created_at
    INTO v_last_hash, v_last_at
  FROM public.lms_course_revisions r
  WHERE r.course_id = p_course_id
  ORDER BY r.revision_number DESC
  LIMIT 1;

  -- Нечего фиксировать: документ тот же, что в последней записи журнала.
  -- Сравнение с записью ЛЮБОГО вида намеренно — автор мог только что сохранить
  -- версию вручную или пройти публикацию, и дублировать её содержимое
  -- автоматической точкой незачем.
  IF v_last_hash = p_content_hash THEN
    RETURN;
  END IF;

  -- Слишком рано. Тоже относительно записи любого вида: журнал не пополняется
  -- автоматическими точками чаще, чем раз в интервал, независимо от того, что
  -- было последним.
  IF v_last_at IS NOT NULL AND v_last_at > now() - p_min_interval THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT * FROM public.create_lms_course_revision(
    p_course_id, 'autosave_checkpoint', p_content, p_content_hash,
    p_created_by, NULL, NULL, NULL
  );
END;
$$;

-- Удержание. Первая реализация НИЧЕГО НЕ УДАЛЯЕТ — так решено в документе
-- 2026-08-23: автоматические точки «may later be compacted by policy; the first
-- implementation does not delete them». Уплотнение — отдельное решение с
-- отдельным сторожем, и принимать его заодно с включением записи нельзя:
-- таблица append-only даже для service_role, и любая чистка потребует
-- собственного грантa, которого сейчас намеренно нет.

REVOKE ALL ON FUNCTION public.checkpoint_lms_course_autosave(uuid, jsonb, text, uuid, interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checkpoint_lms_course_autosave(uuid, jsonb, text, uuid, interval) TO service_role;
