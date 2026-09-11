import { createHash } from "node:crypto";
import { asJson } from "@/lib/db/types";

import { adminClient } from "@/lib/auth/adminClient";
import { diffCourses, validateCourse, type Course, type LessonChange } from "@/lms-core";

export type CourseRevisionKind = "manual" | "review_submitted" | "published" | "restored" | "autosave_checkpoint";

export type CourseRevisionSummary = {
  id: string;
  revisionNumber: number;
  kind: CourseRevisionKind;
  contentHash: string;
  label: string | null;
  createdBy: string | null;
  /**
   * Кто это сделал, человеческим именем.
   *
   * `createdBy` — это auth-id, который ничего не говорит тому, кто читает
   * историю. Для ревью-гейта «документ такой-то» без «от кого» доказывает
   * половину: подпись под отправкой и под одобрением и есть вторая половина.
   * `null`, если запись сделала система (крон, импорт) или аккаунт исчез.
   */
  actor: string | null;
  parentRevisionId: string | null;
  sourceRevisionId: string | null;
  createdAt: string;
};

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  }
  return value;
}

/**
 * Хеш СОДЕРЖАНИЯ курса — того, что автор написал.
 *
 * `version` из него исключён намеренно, и это не мелочь. Каждое сохранение
 * инкрементирует `version`, поэтому документ, к которому автор не притронулся,
 * всё равно приходил бы сюда с новым числом — и дедупликация по хешу, ради
 * которой хеш существует, не срабатывала бы НИКОГДА. Точка восстановления
 * писалась бы на каждом интервале, включая те, где ничего не менялось.
 *
 * Основание не в удобстве: `version` — «learner cache/release invalidation and
 * must not be treated as a human-visible revision number»
 * (docs/lms-course-version-history-2026-08-23.md). Это служебный счётчик, а не
 * содержание, и в отпечатке содержания ему нечего делать. Сам документ в
 * `content` сохраняется целиком, вместе с версией.
 */
export function courseRevisionHash(course: Course): string {
  const { version: _version, ...content } = course;
  void _version;
  return createHash("sha256")
    .update(JSON.stringify(canonical(content)))
    .digest("hex");
}

/**
 * Имена авторов записей — одним запросом на всю историю, а не по запросу на
 * строку. История из сорока точек иначе стоила бы сорок обращений к базе за
 * подписями.
 */
async function resolveActors(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const { data, error } = await adminClient()
    .from("platform_users")
    .select("auth_user_id, email, full_name")
    .in("auth_user_id", unique);
  if (error) {
    // Подпись — украшение записи, а не сама запись: историю показываем и без неё.
    console.warn(`lms: revision actors unresolved — ${error.message}`);
    return new Map();
  }
  return new Map(
    (data ?? []).map(
      (row) =>
        [
          row.auth_user_id as string,
          ((row.full_name as string | null) || (row.email as string | null) || "") as string,
        ].filter(Boolean) as [string, string],
    ),
  );
}

export async function listCourseRevisions(courseId: string): Promise<CourseRevisionSummary[]> {
  const { data, error } = await adminClient()
    .from("lms_course_revisions")
    .select(
      "id, revision_number, kind, content_hash, label, created_by, parent_revision_id, source_revision_id, created_at",
    )
    .eq("course_id", courseId)
    .order("revision_number", { ascending: false });
  if (error) throw new Error(`lms_revision_list_failed:${error.message}`);

  const rows = data ?? [];
  const actors = await resolveActors(rows.map((row) => row.created_by as string | null).filter(Boolean) as string[]);

  return rows.map((row) => ({
    id: row.id as string,
    revisionNumber: Number(row.revision_number),
    kind: row.kind as CourseRevisionKind,
    contentHash: row.content_hash as string,
    label: (row.label as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    actor: actors.get(row.created_by as string) ?? null,
    parentRevisionId: (row.parent_revision_id as string | null) ?? null,
    sourceRevisionId: (row.source_revision_id as string | null) ?? null,
    createdAt: row.created_at as string,
  }));
}

export async function loadCourseRevision(
  courseId: string,
  revisionId: string,
): Promise<(CourseRevisionSummary & { content: Course }) | null> {
  const { data, error } = await adminClient()
    .from("lms_course_revisions")
    .select(
      "id, revision_number, kind, content_hash, label, created_by, parent_revision_id, source_revision_id, created_at, content",
    )
    .eq("course_id", courseId)
    .eq("id", revisionId)
    .maybeSingle();
  if (error) throw new Error(`lms_revision_read_failed:${error.message}`);
  if (!data) return null;
  /* READ, so the contract ceiling does not apply — the same rule as
     `courseFromRows`. A revision is by definition an OLD document, and a
     presentation limit tightened after it was written must not make history
     unreadable: the one artifact that exists to prove what a course used to say
     would start refusing to open precisely for the oldest entries. */
  validateCourse(data.content, "course_revision", "stored");
  return {
    id: data.id as string,
    revisionNumber: Number(data.revision_number),
    kind: data.kind as CourseRevisionKind,
    contentHash: data.content_hash as string,
    label: (data.label as string | null) ?? null,
    createdBy: (data.created_by as string | null) ?? null,
    actor:
      (await resolveActors([data.created_by as string].filter(Boolean) as string[])).get(data.created_by as string) ??
      null,
    parentRevisionId: (data.parent_revision_id as string | null) ?? null,
    sourceRevisionId: (data.source_revision_id as string | null) ?? null,
    createdAt: data.created_at as string,
    content: data.content as Course,
  };
}

export async function createCourseRevision(input: {
  course: Course;
  kind: CourseRevisionKind;
  actorId: string;
  label?: string | null;
  parentRevisionId?: string | null;
  sourceRevisionId?: string | null;
}): Promise<{ id: string; revisionNumber: number; createdAt: string }> {
  validateCourse(input.course, "course_revision");
  const { data, error } = await adminClient().rpc("create_lms_course_revision", {
    p_course_id: input.course.id,
    p_kind: input.kind,
    p_content: asJson(input.course),
    p_content_hash: courseRevisionHash(input.course),
    p_created_by: input.actorId ?? undefined,
    // The rpc's optional args default to NULL; omitting one is the same call.
    p_label: input.label?.trim() || undefined,
    p_parent_revision_id: input.parentRevisionId ?? undefined,
    p_source_revision_id: input.sourceRevisionId ?? undefined,
  });
  if (error) throw new Error(`lms_revision_write_failed:${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("lms_revision_write_failed:empty_result");
  return { id: row.id as string, revisionNumber: Number(row.revision_number), createdAt: row.created_at as string };
}

/**
 * Ручной чекпоинт — ОДНА запись на одно состояние документа.
 *
 * Контракт 2026-08-23 требует дедупликации («creates a deduplicated
 * checkpoint»), и до сих пор её не было: два нажатия подряд клали в историю две
 * одинаковые версии, которые человек потом разбирает глазами.
 *
 * Решает база, той же логикой и по той же причине, что и для автосохранения:
 * это свойство данных, а не поведение экрана, и между чтением «последней» в
 * коде и записью встаёт вторая вкладка. Отличие в ответе — здесь возвращается
 * СУЩЕСТВУЮЩАЯ запись с `created: false`, потому что человек нажал кнопку и
 * ждёт ответа: пустота на месте ответа читается как сломанная кнопка.
 */
export async function createCourseCheckpointOnce(input: {
  course: Course;
  actorId: string;
  label?: string | null;
}): Promise<{ id: string; revisionNumber: number; createdAt: string; created: boolean }> {
  validateCourse(input.course, "course_revision");
  const { data, error } = await adminClient().rpc("create_lms_course_revision_once", {
    p_course_id: input.course.id,
    p_kind: "manual",
    p_content: asJson(input.course),
    p_content_hash: courseRevisionHash(input.course),
    p_created_by: input.actorId ?? undefined,
    p_label: input.label?.trim() || undefined,
  });
  if (error) {
    // Функция появилась миграцией 2026-09-07_lms_journal_links.sql. Пока её нет,
    // ведём себя как вчера — с дублями, но без отказа автору в сохранении.
    if (error.code === "PGRST202" || /could not find the function|schema cache/i.test(error.message)) {
      const fallback = await createCourseRevision({ ...input, kind: "manual" });
      return { ...fallback, created: true };
    }
    throw new Error(`lms_revision_write_failed:${error.message}`);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("lms_revision_write_failed:empty_result");
  return {
    id: row.id as string,
    revisionNumber: Number(row.revision_number),
    createdAt: row.created_at as string,
    created: row.created === true,
  };
}

export type LessonRevisionEntry = {
  revision: CourseRevisionSummary;
  /** Что случилось с уроком именно в этой записи. */
  change: LessonChange;
};

/**
 * ИСТОРИЯ ОДНОГО УРОКА — представление над историей курса, а не вторая история.
 *
 * Отдельной таблицы версий урока нет намеренно. Урок не самостоятелен: перенос
 * блока между уроками, перестановка модулей, готовность, считающаяся по всему
 * курсу, — ни у чего из этого нет корректного представления «на один урок», а
 * две независимые истории начали бы расходиться в первый же такой день. Поэтому
 * снимок остаётся курсовым, а «версии этого урока» — фильтр по нему,
 * вычисляемый по запросу (та же причина, по которой не хранится и diff).
 *
 * ЦЕНА НАЗВАНА ЧЕСТНО. В отличие от `listCourseRevisions`, эта функция ГРУЗИТ
 * содержимое ревизий: понять, менялся ли урок, нельзя не заглянув внутрь.
 * Поэтому запрос ограничен последними `limit` записями — история урока нужна
 * как «что с ним происходило в последнее время», и открывается она по кнопке, а
 * не при каждом рендере.
 */
export async function listLessonRevisions(
  courseId: string,
  lessonId: string,
  limit = 60,
): Promise<LessonRevisionEntry[]> {
  const { data, error } = await adminClient()
    .from("lms_course_revisions")
    .select(
      "id, revision_number, kind, content_hash, label, created_by, parent_revision_id, source_revision_id, created_at, content",
    )
    .eq("course_id", courseId)
    .order("revision_number", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`lms_revision_list_failed:${error.message}`);

  const rows = data ?? [];
  const actors = await resolveActors(rows.map((row) => row.created_by as string | null).filter(Boolean) as string[]);

  const summarize = (row: Record<string, unknown>): CourseRevisionSummary => ({
    id: row.id as string,
    revisionNumber: Number(row.revision_number),
    kind: row.kind as CourseRevisionKind,
    contentHash: row.content_hash as string,
    label: (row.label as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    actor: actors.get(row.created_by as string) ?? null,
    parentRevisionId: (row.parent_revision_id as string | null) ?? null,
    sourceRevisionId: (row.source_revision_id as string | null) ?? null,
    createdAt: row.created_at as string,
  });

  /* Идём от старой к новой и сравниваем каждую с предыдущей: запись попадает в
     историю урока, только если в ней урок действительно изменился. Иначе
     «история урока» повторяла бы всю историю курса, где правка была где угодно
     ещё — то есть отвечала бы не на заданный вопрос. */
  const ordered = [...rows].reverse();
  const entries: LessonRevisionEntry[] = [];

  for (let index = 0; index < ordered.length; index += 1) {
    const row = ordered[index];
    const previous = ordered[index - 1];
    if (!previous) continue;

    // Читаем чужие сохранённые документы: потолок контракта только на записи.
    try {
      validateCourse(row.content, "course_revision", "stored");
      validateCourse(previous.content, "course_revision", "stored");
    } catch {
      continue;
    }

    const diff = diffCourses(previous.content as Course, row.content as Course);
    const change = diff.lessons.find((entry) => entry.lessonId === lessonId);
    if (change) entries.push({ revision: summarize(row), change });
  }

  return entries.reverse();
}
