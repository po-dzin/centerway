/**
 * The reader's journal — every mark they have made, across every course.
 *
 * Server-only.
 *
 * THIS FILE IS THE CROSSING, and it is the only one. `annotations.ts` refuses
 * to know what a user is; it takes enrollment ids and nothing else. Turning a
 * signed-in person into that array is the step that reaches across courses, so
 * it happens here, once, in eleven lines, where it can be read and reviewed —
 * rather than as a `.eq("auth_user_id", …)` grown quietly into the module that
 * holds the private table.
 *
 * The enrollment read is BY ACCOUNT and nothing else. It does not project what
 * opening a course would grant (`listLearnerCourses` does that for the shelf,
 * and it costs a purchase replay per card): the journal is a record of what was
 * already written, and a mark cannot exist without the enrollment it was
 * written under.
 */

import { adminClient } from "@/lib/auth/adminClient";
import {
  accessStateOf,
  buildJournalEntries,
  flattenLessons,
  resolveTimeZone,
  type JournalEntry,
  type JournalPlace,
} from "@/lms-core";

import { listFeedMarks } from "@/lib/feed/server";
import { feedPostPath } from "@/lib/feed/model";

import { listJournalMarks } from "./annotations";
import { listLiveCourses } from "./liveCatalog";
import { getLearnerSettings, type LearnerIdentity } from "./server";

type EnrollmentRow = {
  id: string;
  course_id: string;
  expires_at: string | null;
  status: string | null;
  blocked_at: string | null;
};

export type Journal = {
  entries: JournalEntry[];
  /** The reader's own zone, so the caller cuts the feed into the right days. */
  timeZone: string;
};

export async function loadJournal(identity: LearnerIdentity, now = new Date()): Promise<Journal> {
  const db = adminClient();

  const [{ data: enrollmentRows, error }, settings] = await Promise.all([
    db
      .from("lms_enrollments")
      .select("id, course_id, expires_at, status, blocked_at")
      .eq("auth_user_id", identity.authUserId),
    getLearnerSettings(identity.authUserId),
  ]);

  if (error) throw new Error(`lms_journal_enrollments_failed:${error.message}`);

  const enrollments = (enrollmentRows ?? []) as EnrollmentRow[];
  const timeZone = resolveTimeZone(settings.timeZone);

  // Marks made on feed posts («Стрічка», 2026-10-16) have no enrollment; they
  // are read by account here — the same crossing, one more table — and woven
  // into the same timeline by time.
  const feedEntries = await readFeedEntries(db, identity.authUserId);

  if (enrollments.length === 0) return { entries: feedEntries, timeZone };

  // The catalogue read is the cached one the shelf already warms, so a journal
  // costs no per-course lookup. It carries drafts too, which is what lets an
  // author's own unpublished course still name the marks made while writing it.
  const [marks, courses] = await Promise.all([listJournalMarks(enrollments.map((row) => row.id)), listLiveCourses()]);

  const courseById = new Map(courses.map((course) => [course.id, course]));

  const places: JournalPlace[] = enrollments.flatMap((row) => {
    const course = courseById.get(row.course_id);
    // No course to name means no place — the marks under this enrollment are
    // still listed, without a course line. `buildJournalEntries` owns that.
    if (!course) return [];

    return [
      {
        enrollmentId: row.id,
        courseSlug: course.slug,
        courseTitle: course.title,
        open:
          accessStateOf(
            { status: row.status ?? "active", blockedAt: row.blocked_at, expiresAt: row.expires_at },
            now,
          ) === "active",
        lessons: flattenLessons(course).map((entry) => ({
          id: entry.lesson.id,
          slug: entry.lesson.slug,
          title: entry.lesson.title,
        })),
      },
    ];
  });

  return { entries: mergeByTime(buildJournalEntries(marks, places), feedEntries), timeZone };
}

async function readFeedEntries(db: ReturnType<typeof adminClient>, authUserId: string): Promise<JournalEntry[]> {
  try {
    const marks = await listFeedMarks(db, authUserId);
    return marks.map((mark) => ({
      clientId: mark.clientId,
      // «Зберегти» on a post (2026-10-17) is a bookmark; a passage is a highlight.
      kind: mark.kind,
      quote: mark.quote,
      note: mark.note,
      createdAt: mark.createdAt,
      updatedAt: mark.updatedAt,
      course: null,
      lesson: null,
      feed: { authorName: mark.authorName ?? "автор" },
      path: feedPostPath(mark.postId),
    }));
  } catch (error) {
    // The feed is the newer half; a failure there must not cost the reader
    // their lesson notes.
    console.error("journal_feed_marks_failed:", error instanceof Error ? error.message : error);
    return [];
  }
}

/** Newest first, the order `buildJournalEntries` already keeps. */
function mergeByTime(a: JournalEntry[], b: JournalEntry[]): JournalEntry[] {
  if (b.length === 0) return a;
  return [...a, ...b].sort((x, y) => y.createdAt.localeCompare(x.createdAt) || x.clientId.localeCompare(y.clientId));
}
