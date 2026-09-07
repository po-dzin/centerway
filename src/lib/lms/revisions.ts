import { createHash } from "node:crypto";

import { adminClient } from "@/lib/auth/adminClient";
import { validateCourse, type Course } from "@/lms-core";

export type CourseRevisionKind = "manual" | "review_submitted" | "published" | "restored" | "autosave_checkpoint";

export type CourseRevisionSummary = {
  id: string;
  revisionNumber: number;
  kind: CourseRevisionKind;
  contentHash: string;
  label: string | null;
  createdBy: string | null;
  sourceRevisionId: string | null;
  createdAt: string;
};

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonical(entry)]));
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
  return createHash("sha256").update(JSON.stringify(canonical(content))).digest("hex");
}

export async function listCourseRevisions(courseId: string): Promise<CourseRevisionSummary[]> {
  const { data, error } = await adminClient().from("lms_course_revisions")
    .select("id, revision_number, kind, content_hash, label, created_by, source_revision_id, created_at")
    .eq("course_id", courseId)
    .order("revision_number", { ascending: false });
  if (error) throw new Error(`lms_revision_list_failed:${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    revisionNumber: Number(row.revision_number),
    kind: row.kind as CourseRevisionKind,
    contentHash: row.content_hash as string,
    label: (row.label as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    sourceRevisionId: (row.source_revision_id as string | null) ?? null,
    createdAt: row.created_at as string,
  }));
}

export async function loadCourseRevision(courseId: string, revisionId: string): Promise<(CourseRevisionSummary & { content: Course }) | null> {
  const { data, error } = await adminClient().from("lms_course_revisions")
    .select("id, revision_number, kind, content_hash, label, created_by, source_revision_id, created_at, content")
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
    p_content: input.course,
    p_content_hash: courseRevisionHash(input.course),
    p_created_by: input.actorId,
    p_label: input.label?.trim() || null,
    p_parent_revision_id: input.parentRevisionId ?? null,
    p_source_revision_id: input.sourceRevisionId ?? null,
  });
  if (error) throw new Error(`lms_revision_write_failed:${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("lms_revision_write_failed:empty_result");
  return { id: row.id as string, revisionNumber: Number(row.revision_number), createdAt: row.created_at as string };
}
