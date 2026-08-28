/**
 * The author's raw material: what a course was built FROM.
 *
 * The table has existed since 2026-08-20 and until now nothing read or wrote
 * it — a migration with no code behind it. That was survivable while the only
 * author was the house, working from files in git. It stops being survivable at
 * the agent contour: A1's whole job is "turn these materials into a draft"
 * (docs/agent-contour-2026-08-21.md §3), and an agent with no materials to read
 * does not structure an author's work, it invents health content. This module
 * is that input, and it exists before the agent so the agent cannot be built
 * without it.
 *
 * TEXT, NOT FILES — see the migration header. The extraction happens where the
 * document is already understood (the builder's import path, or the agent
 * session), and what lands here is what a reader can actually read.
 *
 * NO ACCESS DECISION LIVES HERE. Every function takes a `courseId` that the
 * caller has already been granted (`courseAccess.ts`) and filters by it, so a
 * source id guessed from another course answers "not found" rather than
 * leaking. That is the same shape as `revisions.ts`: the service trusts the
 * grant, and the grant is issued in exactly one place.
 */

import { adminClient } from "@/lib/auth/adminClient";

export const SOURCE_KINDS = ["document", "transcript", "video", "link", "note"] as const;
export type CourseSourceKind = (typeof SOURCE_KINDS)[number];

/**
 * A ceiling on stored text, in characters.
 *
 * Not a performance limit — a shape one. A source is a document an author is
 * working from; a megabyte of it is an archive, and archives belong in the
 * media pipeline where they get a checksum, a bucket and a sweeper. Half a
 * million characters is roughly a 200-page book.
 */
export const MAX_EXTRACTED_CHARS = 500_000;

export type CourseSourceSummary = {
  id: string;
  kind: CourseSourceKind;
  title: string;
  origin: string | null;
  mimeType: string | null;
  byteSize: number | null;
  checksum: string | null;
  /** Length of the stored text, so a caller can budget before fetching it. */
  extractedChars: number;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CourseSource = CourseSourceSummary & { extractedText: string | null };

type Row = Record<string, unknown>;

const COLUMNS = "id, kind, title, origin, mime_type, byte_size, checksum, uploaded_by, created_at, updated_at";

function toSummary(row: Row, extractedChars: number): CourseSourceSummary {
  return {
    id: row.id as string,
    kind: row.kind as CourseSourceKind,
    title: row.title as string,
    origin: (row.origin as string | null) ?? null,
    mimeType: (row.mime_type as string | null) ?? null,
    byteSize: (row.byte_size as number | null) ?? null,
    checksum: (row.checksum as string | null) ?? null,
    extractedChars,
    uploadedBy: (row.uploaded_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * The materials registered against a course, newest first.
 *
 * The list does NOT carry `extracted_text`. A course assembled from a dozen
 * documents would otherwise ship a book down the wire every time the builder
 * drew a sidebar — and an agent listing its inputs before choosing one would
 * pay for all of them to read none.
 */
export async function listCourseSources(courseId: string): Promise<CourseSourceSummary[]> {
  const { data, error } = await adminClient()
    .from("lms_course_sources")
    .select(`${COLUMNS}, extracted_text`)
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`lms_source_list_failed:${error.message}`);
  return ((data ?? []) as Row[]).map((row) => toSummary(row, String(row.extracted_text ?? "").length));
}

/** One source, with its text. Scoped by course so a guessed id finds nothing. */
export async function readCourseSource(courseId: string, id: string): Promise<CourseSource | null> {
  const { data, error } = await adminClient()
    .from("lms_course_sources")
    .select(`${COLUMNS}, extracted_text`)
    .eq("course_id", courseId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`lms_source_read_failed:${error.message}`);
  if (!data) return null;
  const row = data as Row;
  const text = (row.extracted_text as string | null) ?? null;
  return { ...toSummary(row, text?.length ?? 0), extractedText: text };
}

export type RegisterSourceInput = {
  courseId: string;
  kind: unknown;
  title: unknown;
  origin?: unknown;
  mimeType?: unknown;
  byteSize?: unknown;
  checksum?: unknown;
  extractedText?: unknown;
  uploadedBy: string | null;
};

function text(value: unknown, field: string, max: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error(`lms_source_invalid_${field}`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new Error(`lms_source_${field}_too_long`);
  return trimmed || null;
}

/**
 * Records one piece of material.
 *
 * Validation mirrors the CHECK constraints rather than trusting them: the
 * database would refuse a bad `kind` with a Postgres error string, and a caller
 * — the builder's panel today, a tool tomorrow — deserves an `lms_source_*`
 * code it can act on, the same way every other authoring failure reads.
 */
export async function registerCourseSource(input: RegisterSourceInput): Promise<CourseSourceSummary> {
  if (!SOURCE_KINDS.includes(input.kind as CourseSourceKind)) {
    throw new Error("lms_source_invalid_kind");
  }
  const title = text(input.title, "title", 300);
  if (!title) throw new Error("lms_source_missing_title");

  const checksum = text(input.checksum, "checksum", 64);
  if (checksum && !/^[0-9a-f]{64}$/.test(checksum)) throw new Error("lms_source_invalid_checksum");

  const extracted = text(input.extractedText, "extracted_text", MAX_EXTRACTED_CHARS);

  const byteSize = input.byteSize === undefined || input.byteSize === null ? null : Number(input.byteSize);
  if (byteSize !== null && (!Number.isFinite(byteSize) || byteSize < 0)) {
    throw new Error("lms_source_invalid_byte_size");
  }

  const { data, error } = await adminClient()
    .from("lms_course_sources")
    .insert({
      course_id: input.courseId,
      kind: input.kind as CourseSourceKind,
      title,
      origin: text(input.origin, "origin", 500),
      mime_type: text(input.mimeType, "mime_type", 120),
      byte_size: byteSize,
      checksum,
      extracted_text: extracted,
      uploaded_by: input.uploadedBy,
    })
    .select(COLUMNS)
    .single();

  if (error) {
    // The partial unique index on (course_id, checksum). Registering the same
    // file against the same course twice is an accident, not an intent — and
    // for an agent retrying a step it is the NORMAL failure, so it gets its own
    // code rather than a raw constraint name.
    if (error.message.includes("uq_lms_course_sources_checksum")) {
      throw new Error("lms_source_duplicate");
    }
    throw new Error(`lms_source_write_failed:${error.message}`);
  }

  return toSummary(data as Row, extracted?.length ?? 0);
}

/** Removes one source. Scoped by course for the same reason the read is. */
export async function deleteCourseSource(courseId: string, id: string): Promise<void> {
  const { error } = await adminClient()
    .from("lms_course_sources")
    .delete()
    .eq("course_id", courseId)
    .eq("id", id);
  if (error) throw new Error(`lms_source_delete_failed:${error.message}`);
}
