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

export function courseRevisionHash(course: Course): string {
  return createHash("sha256").update(JSON.stringify(canonical(course))).digest("hex");
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
  validateCourse(data.content, "course_revision");
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
