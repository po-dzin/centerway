/**
 * Server-side reader annotations — bookmarks, highlights, margin notes.
 *
 * Server-only: imports the service-role client. Never import from a client
 * component.
 *
 * The rows are private to the reader who wrote them (see the migration header:
 * `lms_annotations` deliberately has no staff read policy). Service-role code
 * bypasses RLS, so THIS module is where that privacy is actually kept: every
 * function takes an `enrollmentId` that the caller has already resolved from
 * the signed-in user, and no function takes a user id or a filter that could
 * reach across enrollments.
 */

import { adminClient } from "@/lib/auth/adminClient";
import {
  clampNote,
  clampPrefix,
  clampQuote,
  type Annotation,
  type AnnotationKind,
} from "@/lms-core";

type AnnotationRow = {
  client_id: string;
  kind: AnnotationKind;
  lesson_id: string;
  block_id: string | null;
  start_offset: number | null;
  end_offset: number | null;
  quote: string | null;
  prefix: string | null;
  note: string | null;
  course_version: number;
  created_at: string;
  updated_at: string;
};

/** A stored row, plus the lesson id the caller maps back to a slug. */
export type StoredAnnotation = Annotation & { lessonId: string };

function toAnnotation(row: AnnotationRow, lessonSlug: string): StoredAnnotation {
  return {
    clientId: row.client_id,
    kind: row.kind,
    lessonId: row.lesson_id,
    lessonSlug,
    anchor:
      row.kind === "highlight" && row.block_id && row.start_offset !== null && row.end_offset !== null
        ? {
            blockId: row.block_id,
            start: row.start_offset,
            end: row.end_offset,
            quote: row.quote ?? "",
            prefix: row.prefix ?? "",
          }
        : null,
    note: row.note,
    courseVersion: row.course_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Every mark this reader has made in this course, oldest first. */
export async function listAnnotations(
  enrollmentId: string,
  lessonSlugById: Map<string, string>
): Promise<StoredAnnotation[]> {
  const db = adminClient();
  const { data, error } = await db
    .from("lms_annotations")
    .select("client_id, kind, lesson_id, block_id, start_offset, end_offset, quote, prefix, note, course_version, created_at, updated_at")
    .eq("enrollment_id", enrollmentId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`lms_annotations_read_failed:${error.message}`);

  return (data ?? [])
    .map((row) => {
      const slug = lessonSlugById.get((row as AnnotationRow).lesson_id);
      // A lesson the author has since deleted takes its marks with it — the row
      // is cascaded away by the database, so this only guards a course whose
      // outline moved under a cached id.
      return slug ? toAnnotation(row as AnnotationRow, slug) : null;
    })
    .filter((value): value is StoredAnnotation => value !== null);
}

export type SaveAnnotationInput = {
  enrollmentId: string;
  lessonId: string;
  lessonSlug: string;
  clientId: string;
  kind: AnnotationKind;
  courseVersion: number;
  anchor: { blockId: string; start: number; end: number; quote: string; prefix: string } | null;
  note: string | null;
};

/**
 * Writes one mark, creating it or replacing what was there.
 *
 * Upsert on (enrollment_id, client_id) rather than insert-then-update: the same
 * call then serves "the reader marked a passage", "the reader typed a note into
 * it" and "the offline device is flushing this twice", and none of the three
 * needs to know which of the others already happened.
 */
export async function saveAnnotation(input: SaveAnnotationInput): Promise<StoredAnnotation> {
  const db = adminClient();
  const note = input.note === null ? null : clampNote(input.note) || null;

  const { data, error } = await db
    .from("lms_annotations")
    .upsert(
      {
        enrollment_id: input.enrollmentId,
        lesson_id: input.lessonId,
        client_id: input.clientId,
        kind: input.kind,
        course_version: input.courseVersion,
        block_id: input.anchor?.blockId ?? null,
        start_offset: input.anchor?.start ?? null,
        end_offset: input.anchor?.end ?? null,
        quote: input.anchor ? clampQuote(input.anchor.quote) : null,
        prefix: input.anchor ? clampPrefix(input.anchor.prefix) : null,
        note,
      },
      { onConflict: "enrollment_id,client_id" }
    )
    .select("client_id, kind, lesson_id, block_id, start_offset, end_offset, quote, prefix, note, course_version, created_at, updated_at")
    .single();

  if (error) throw new Error(`lms_annotation_write_failed:${error.message}`);
  return toAnnotation(data as AnnotationRow, input.lessonSlug);
}

/** Removes one mark. Deleting something that is already gone is success. */
export async function deleteAnnotation(enrollmentId: string, clientId: string): Promise<void> {
  const db = adminClient();
  const { error } = await db
    .from("lms_annotations")
    .delete()
    .eq("enrollment_id", enrollmentId)
    .eq("client_id", clientId);

  if (error) throw new Error(`lms_annotation_delete_failed:${error.message}`);
}
