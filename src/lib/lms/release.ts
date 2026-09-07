/**
 * The RELEASE path: project a course document onto the learner-facing rows and
 * append the journal entry that proves it happened — together, or not at all.
 *
 * WHY THIS EXISTS SEPARATELY FROM authoring.ts. `writeCourseStructure` is the
 * shared write path and stays exactly what it is: three independent requests
 * with a carefully chosen order. It has no transaction available to it, which
 * its own comments have said for months. That is tolerable for a draft save and
 * NOT tolerable for the three journal kinds that make history evidence rather
 * than convenience — `review_submitted`, `published`, `restored` — because
 * docs/lms-course-version-history-2026-08-23.md forbids the save-then-log shape
 * outright:
 *
 *   "A two-request or save-then-log implementation is forbidden because it can
 *    report failure after the document has already changed."
 *
 * So this module does the same preparation (`prepareCourseWrite`, one owner of
 * the mapping and the readiness gate) and the same removal guards
 * (`planRemovedRows`, one owner of "may this lesson be deleted"), then hands
 * the result to `apply_lms_course_release`, which commits the projection and
 * the revision in one transaction.
 *
 * Applies docs/migration/sql/2026-09-07_lms_course_release_journal.sql.
 */

import { adminClient } from "@/lib/auth/adminClient";
import type { Course } from "@/lms-core";

import { planRemovedRows, prepareCourseWrite, type WriteCourseOptions, type WriteCourseResult } from "./authoring";
import { courseRevisionHash, type CourseRevisionKind } from "./revisions";

export type ReleaseJournalEntry = {
  kind: CourseRevisionKind;
  /** Null for a system actor (cron, import); the column is nullable on purpose. */
  actorId: string | null;
  label?: string | null;
  /** The revision this one was produced FROM — set on `restored`. */
  sourceRevisionId?: string | null;
};

export type CourseRevisionRef = { id: string; revisionNumber: number; createdAt: string };

/**
 * PostgREST reports an absent function as PGRST202 rather than a SQL error,
 * because it resolves the name against its schema cache first.
 *
 * Migrations here are applied by hand in the Supabase SQL editor, so "the code
 * shipped but the migration has not run yet" is a real state the whole codebase
 * already feature-detects for (`revisionEnabled`, `reviewEnabled`,
 * `lms_authoring_missing_reference_column`). This keeps that habit instead of
 * failing with a message that reads like a bug.
 */
function isMissingFunction(error: { code?: string; message: string }): boolean {
  return error.code === "PGRST202"
    || /could not find the function/i.test(error.message)
    || /schema cache/i.test(error.message);
}

export const JOURNAL_MIGRATION_REQUIRED = "lms_release_journal_migration_required";

/**
 * One transactional release.
 *
 * `finalValues` carries whatever else the caller needs written to the course
 * row in the same commit — clearing `pending_content` on approval, resetting
 * review state on withdrawal. It lands with the status flip, last, so a caller
 * cannot accidentally publish the status before the structure is there.
 */
export async function writeCourseRelease(input: {
  courseId: string;
  course: unknown;
  journal: ReleaseJournalEntry;
  finalValues?: Record<string, unknown>;
  optionalColumns?: WriteCourseOptions["optionalColumns"];
}): Promise<{ result: WriteCourseResult; revision: CourseRevisionRef }> {
  const prepared = prepareCourseWrite(input.course, { optionalColumns: input.optionalColumns });
  const course = prepared.course;

  const db = adminClient();

  // The guards run BEFORE the transaction and read the current rows: a lesson
  // that a learner has already touched must stop the release here, with the
  // same error code the non-transactional path raises, rather than inside a
  // function whose failure the author would read as a database problem.
  const writer = db as unknown as Parameters<typeof planRemovedRows>[0];
  const { removedLessonIds, deletableModuleIds } = await planRemovedRows(writer, course);

  const { data, error } = await db.rpc("apply_lms_course_release", {
    p_course_id: input.courseId,
    p_course: prepared.courseWithoutStatus,
    p_modules: prepared.modules,
    p_lessons: prepared.lessons,
    p_remove_lesson_ids: removedLessonIds,
    p_remove_module_ids: deletableModuleIds,
    p_final_values: { ...prepared.finalValues, ...(input.finalValues ?? {}) },
    p_kind: input.journal.kind,
    p_content: course,
    p_content_hash: courseRevisionHash(course),
    p_created_by: input.journal.actorId,
    p_label: input.journal.label?.trim() || null,
    p_source_revision_id: input.journal.sourceRevisionId ?? null,
  });

  if (error) {
    if (isMissingFunction(error)) throw new Error(JOURNAL_MIGRATION_REQUIRED);
    throw new Error(`lms_release_failed:${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("lms_release_failed:empty_result");

  return {
    result: {
      slug: course.slug,
      status: course.status,
      moduleCount: prepared.modules.length,
      lessonCount: prepared.lessons.length,
      blockers: prepared.blockers,
    },
    revision: {
      id: row.id as string,
      revisionNumber: Number(row.revision_number),
      createdAt: row.created_at as string,
    },
  };
}

/**
 * A state change that moves no structure but must still be provable: the exact
 * document an author submitted for review, or the one that was withdrawn.
 *
 * The document is journaled even though no lesson row changes, because the
 * point of `review_submitted` is to pin WHAT WAS SENT. Without it the review
 * gate leaves no artifact: `pending_content` is nulled on approval, and
 * `audit_log` records the act of approving without the thing approved.
 */
export async function journalCourseState(input: {
  courseId: string;
  course: Course;
  values?: Record<string, unknown>;
  journal: ReleaseJournalEntry;
}): Promise<CourseRevisionRef> {
  const { data, error } = await adminClient().rpc("journal_lms_course_state", {
    p_course_id: input.courseId,
    p_values: input.values ?? {},
    p_kind: input.journal.kind,
    p_content: input.course,
    p_content_hash: courseRevisionHash(input.course),
    p_created_by: input.journal.actorId,
    p_label: input.journal.label?.trim() || null,
    p_source_revision_id: input.journal.sourceRevisionId ?? null,
  });

  if (error) {
    if (isMissingFunction(error)) throw new Error(JOURNAL_MIGRATION_REQUIRED);
    throw new Error(`lms_release_failed:${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("lms_release_failed:empty_result");
  return { id: row.id as string, revisionNumber: Number(row.revision_number), createdAt: row.created_at as string };
}

/**
 * Редкая точка восстановления поверх частого автосохранения.
 *
 * BEST-EFFORT, И ЭТО НЕ ПРОТИВОРЕЧИТ ЗАПРЕТУ НА save-then-log. Запрет защищает
 * записи, которые что-то ДОКАЗЫВАЮТ: `review_submitted`, `published` и
 * `restored` обязаны попасть в журнал вместе с изменением документа, иначе
 * журнал врёт о том, что произошло. Автоматическая точка ничего не
 * доказывает — это удобство восстановления. Не записавшаяся точка означает
 * лишь одну пропущенную точку, а вот упавшее из-за неё сохранение означает
 * потерянный абзац у автора, который просто печатал.
 *
 * Решение «писать или не писать» целиком внутри функции базы: дедупликация по
 * хешу и интервал — свойства данных, и две вкладки одного автора не должны
 * получать разные ответы на один вопрос.
 */
export async function checkpointAutosave(input: {
  courseId: string;
  course: Course;
  actorId: string | null;
}): Promise<CourseRevisionRef | null> {
  const { data, error } = await adminClient().rpc("checkpoint_lms_course_autosave", {
    p_course_id: input.courseId,
    p_content: input.course,
    p_content_hash: courseRevisionHash(input.course),
    p_created_by: input.actorId,
  });

  if (error) {
    if (!isMissingFunction(error)) {
      console.warn(`lms: autosave checkpoint failed for ${input.course.slug} — ${error.message}`);
    }
    return null;
  }

  // Пустой результат — это отказ по интервалу или по совпадению хеша, то есть
  // штатная работа функции, а не сбой.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { id: row.id as string, revisionNumber: Number(row.revision_number), createdAt: row.created_at as string };
}
