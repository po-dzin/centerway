-- Журнал версий: связи, которых не хватало.
--
-- Три пункта контракта из docs/lms-course-version-history-2026-08-23.md были
-- объявлены и не выполнены. Все три — про СВЯЗИ между записями, а не про сами
-- записи, поэтому их отсутствие ничего не ломало и ничем себя не выдавало.
--
-- 1. `published_revision_id` на `lms_courses` существует с 2026-08-23 вместе с
--    внешним ключом и не заполнялась НИКОГДА. Контракт: «points at the
--    immutable release record». Без неё по строке курса нельзя ответить, какая
--    ревизия стоит релизом прямо сейчас, — приходится угадывать по времени,
--    то есть ровно тем способом, ради отказа от которого журнал заводили.
--
-- 2. `parent_revision_id` принимался и всегда приходил NULL. Цепочка «что было
--    до этого» не строилась ни разу. Родитель здесь — предыдущая запись
--    журнала этого курса, и знает её база, а не вызывающий код: вызывающему
--    пришлось бы сперва её прочитать, а между чтением и записью встаёт вторая
--    вкладка.
--
-- 3. Ручной чекпоинт обязан был дедуплицироваться («creates a deduplicated
--    checkpoint»), а создавался всегда. Два нажатия подряд — две одинаковые
--    версии в истории, которую человек потом глазами разбирает.
--
-- Требует 2026-09-07_lms_course_release_journal.sql.

-- Родитель проставляется САМОЙ функцией, если вызывающий не назвал его явно.
-- Всё остальное в теле — как было в 2026-08-23; функция заменяется целиком,
-- потому что PL/pgSQL нельзя пропатчить частично.
CREATE OR REPLACE FUNCTION public.create_lms_course_revision(
  p_course_id uuid,
  p_kind text,
  p_content jsonb,
  p_content_hash text,
  p_created_by uuid DEFAULT NULL,
  p_label text DEFAULT NULL,
  p_parent_revision_id uuid DEFAULT NULL,
  p_source_revision_id uuid DEFAULT NULL
)
RETURNS TABLE (id uuid, revision_number bigint, created_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_revision_number bigint;
  v_parent uuid;
BEGIN
  UPDATE public.lms_courses
  SET revision_seq = revision_seq + 1
  WHERE public.lms_courses.id = p_course_id
  RETURNING revision_seq INTO v_revision_number;

  IF v_revision_number IS NULL THEN
    RAISE EXCEPTION 'lms_course_not_found';
  END IF;

  -- Предыдущая запись журнала этого курса. Читается ПОСЛЕ того, как счётчик
  -- уже занят этой транзакцией, поэтому две параллельные записи не назовут
  -- родителем одну и ту же запись, разойдясь в разные ветки молча.
  v_parent := p_parent_revision_id;
  IF v_parent IS NULL THEN
    SELECT r.id INTO v_parent
    FROM public.lms_course_revisions r
    WHERE r.course_id = p_course_id
    ORDER BY r.revision_number DESC
    LIMIT 1;
  END IF;

  RETURN QUERY
  INSERT INTO public.lms_course_revisions (
    course_id, revision_number, kind, content, content_hash, label,
    created_by, parent_revision_id, source_revision_id
  ) VALUES (
    p_course_id, v_revision_number, p_kind, p_content, p_content_hash,
    NULLIF(btrim(p_label), ''), p_created_by, v_parent,
    p_source_revision_id
  )
  RETURNING lms_course_revisions.id, lms_course_revisions.revision_number,
    lms_course_revisions.created_at;
END;
$$;

-- Одна запись на одно состояние документа.
--
-- Возвращает СУЩЕСТВУЮЩУЮ запись, если содержимое совпадает с последней, и
-- говорит об этом флагом `created`. Молча возвращать пустоту здесь нельзя (в
-- отличие от автосохранения, где никто не ждёт ответа): человек нажал кнопку и
-- должен узнать, что версия уже сохранена, а не решить, что кнопка сломана.
CREATE OR REPLACE FUNCTION public.create_lms_course_revision_once(
  p_course_id uuid,
  p_kind text,
  p_content jsonb,
  p_content_hash text,
  p_created_by uuid DEFAULT NULL,
  p_label text DEFAULT NULL
)
RETURNS TABLE (id uuid, revision_number bigint, created_at timestamptz, created boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_existing public.lms_course_revisions%ROWTYPE;
BEGIN
  SELECT * INTO v_existing
  FROM public.lms_course_revisions r
  WHERE r.course_id = p_course_id
  ORDER BY r.revision_number DESC
  LIMIT 1;

  IF v_existing.id IS NOT NULL AND v_existing.content_hash = p_content_hash THEN
    RETURN QUERY SELECT v_existing.id, v_existing.revision_number, v_existing.created_at, false;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.id, c.revision_number, c.created_at, true
  FROM public.create_lms_course_revision(
    p_course_id, p_kind, p_content, p_content_hash, p_created_by, p_label, NULL, NULL
  ) c;
END;
$$;

-- Релиз, на который сейчас смотрит ученик, назван по имени.
--
-- Проставляется ВНУТРИ той же транзакции, что и проекция с записью журнала:
-- курс, который считается опубликованным, и запись, которая это доказывает,
-- расходиться не должны даже на мгновение.
CREATE OR REPLACE FUNCTION public.apply_lms_course_release(
  p_course_id uuid,
  p_course jsonb,
  p_modules jsonb,
  p_lessons jsonb,
  p_remove_lesson_ids uuid[],
  p_remove_module_ids uuid[],
  p_final_values jsonb,
  p_kind text,
  p_content jsonb,
  p_content_hash text,
  p_created_by uuid DEFAULT NULL,
  p_label text DEFAULT NULL,
  p_source_revision_id uuid DEFAULT NULL
)
RETURNS TABLE (id uuid, revision_number bigint, created_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_exists boolean;
  v_revision record;
BEGIN
  SELECT true INTO v_exists FROM public.lms_courses c WHERE c.id = p_course_id;

  IF v_exists IS NULL THEN
    PERFORM public.cw_apply_row_set('public.lms_courses'::regclass, jsonb_build_array(p_course));
  ELSE
    PERFORM public.cw_patch_lms_course(p_course_id, p_course);
  END IF;

  PERFORM public.cw_apply_row_set('public.lms_modules'::regclass, p_modules);
  PERFORM public.cw_apply_row_set('public.lms_lessons'::regclass, p_lessons);

  IF p_remove_lesson_ids IS NOT NULL AND array_length(p_remove_lesson_ids, 1) > 0 THEN
    DELETE FROM public.lms_lessons l WHERE l.id = ANY(p_remove_lesson_ids);
  END IF;

  IF p_remove_module_ids IS NOT NULL AND array_length(p_remove_module_ids, 1) > 0 THEN
    DELETE FROM public.lms_modules m WHERE m.id = ANY(p_remove_module_ids);
  END IF;

  PERFORM public.cw_patch_lms_course(p_course_id, p_final_values);

  SELECT * INTO v_revision FROM public.create_lms_course_revision(
    p_course_id, p_kind, p_content, p_content_hash,
    p_created_by, p_label, NULL, p_source_revision_id
  );

  -- Только релиз. `restored` кладёт документ в pending и живого выпуска не
  -- трогает; `review_submitted` тем более.
  IF p_kind = 'published' THEN
    UPDATE public.lms_courses c
    SET published_revision_id = v_revision.id
    WHERE c.id = p_course_id;
  END IF;

  RETURN QUERY SELECT v_revision.id, v_revision.revision_number, v_revision.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.create_lms_course_revision_once(uuid, text, jsonb, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_lms_course_revision_once(uuid, text, jsonb, text, uuid, text) TO service_role;

-- Право на UPDATE `lms_courses` у service_role уже есть; таблица ревизий
-- остаётся append-only — здесь она по-прежнему только читается и дополняется.
