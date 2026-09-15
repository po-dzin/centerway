/**
 * How many people are inside an author's courses, and how many of them are
 * still moving.
 *
 * WHY AN AUTHOR MAY SEE THIS AT ALL. The creator contract splits what an author
 * owns from what the house owns: the price is admin-only because an author who
 * could set it could set their own payout (`docs/creator-contract-2026-08-22.md`).
 * Audience size is on the other side of that line — it is the answer to «чи
 * читає це хтось», which is the author's own question about their own work, and
 * leaving them to ask an administrator for it makes the workshop a place you
 * cannot finish a thought in.
 *
 * COUNTS, NEVER PEOPLE. Nothing here returns an account, a name, an email or an
 * enrollment id, and the API above it returns the same four integers per course.
 * That is the same boundary `lms_annotations` already draws — an author does not
 * see what a learner underlined — held one level up: the author learns that
 * seven people opened the course this week, never which seven.
 *
 * ONE DEFINITION OF OPEN ACCESS. `isAccessOpen` decides who counts as a
 * learner, the same function the player, the reminder cron and the admin panel
 * ask. A second predicate here — «expires_at is null or in the future» — would
 * be a fifth opinion about who is enrolled, and it would be wrong the first time
 * anyone was blocked rather than expired.
 *
 * Server-only: imports the service-role client.
 */

import { adminClient } from "@/lib/auth/adminClient";
import { isAccessOpen } from "@/lms-core/access";

export type CourseAudience = {
  /** People whose access is open right now. */
  learners: number;
  /** People who were enrolled and whose access has since closed. */
  lapsed: number;
  /** Of the open ones, how many arrived inside the recent window. */
  joinedRecently: number;
  /** How many distinct learners produced a progress event in the active window. */
  activeRecently: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** «Нових» is a month; a shorter window reads as noise on a course sold weekly. */
export const AUDIENCE_JOINED_DAYS = 30;
/** «Активних» is a week — the span an author plans a cohort in. */
export const AUDIENCE_ACTIVE_DAYS = 7;

export type AudienceEnrollmentRow = {
  id: string;
  courseId: string;
  startedAt: string | null;
  expiresAt: string | null;
  status: string | null;
  blockedAt: string | null;
};

export function emptyAudience(): CourseAudience {
  return { learners: 0, lapsed: 0, joinedRecently: 0, activeRecently: 0 };
}

/**
 * The whole count, as arithmetic — no database, so the rules are testable.
 *
 * `activeEnrollmentIds` is a SET of enrollment ids seen in the activity window,
 * deduplicated by the caller: a learner who opened eleven lessons on Tuesday is
 * one active person, and counting events would have made the busiest reader look
 * like a cohort.
 */
export function foldCourseAudience(input: {
  courseIds: string[];
  enrollments: AudienceEnrollmentRow[];
  activeEnrollmentIds: Set<string>;
  now: Date;
}): Map<string, CourseAudience> {
  const joinedCutoff = input.now.getTime() - AUDIENCE_JOINED_DAYS * DAY_MS;
  const audience = new Map<string, CourseAudience>(input.courseIds.map((id) => [id, emptyAudience()]));

  for (const row of input.enrollments) {
    const entry = audience.get(row.courseId);
    // A row for a course this caller did not ask about is not this caller's
    // business, even inside a service-role read.
    if (!entry) continue;

    const open = isAccessOpen({ status: row.status, blockedAt: row.blockedAt, expiresAt: row.expiresAt }, input.now);

    if (!open) {
      entry.lapsed += 1;
      continue;
    }

    entry.learners += 1;
    const started = row.startedAt ? Date.parse(row.startedAt) : Number.NaN;
    if (Number.isFinite(started) && started >= joinedCutoff) entry.joinedRecently += 1;
    /* ACTIVITY IS COUNTED ONLY FOR OPEN SEATS, so the two numbers can be read
       as one sentence: «42 учні · 7 активних» never says that more people were
       active than are enrolled, which is what counting a lapsed learner's last
       session would produce. */
    if (input.activeEnrollmentIds.has(row.id)) entry.activeRecently += 1;
  }

  return audience;
}

/**
 * The three reads behind that fold.
 *
 * The activity read is bounded by the author's own LESSONS rather than by their
 * learners: `lms_progress_events` carries `lesson_id` and not `course_id`, and
 * filtering by lesson keeps the query proportional to how much was read this
 * week instead of to how many people have ever enrolled.
 */
export async function readCourseAudience(
  courseIds: string[],
  now: Date = new Date(),
): Promise<Map<string, CourseAudience>> {
  if (courseIds.length === 0) return new Map();
  const db = adminClient();

  const { data: enrollmentRows, error: enrollmentError } = await db
    .from("lms_enrollments")
    .select("id, course_id, started_at, expires_at, status, blocked_at")
    .in("course_id", courseIds);
  if (enrollmentError) throw new Error(`lms_audience_enrollments_failed:${enrollmentError.message}`);

  const enrollments: AudienceEnrollmentRow[] = (enrollmentRows ?? []).map((row) => ({
    id: row.id as string,
    courseId: row.course_id as string,
    startedAt: (row.started_at as string | null) ?? null,
    expiresAt: (row.expires_at as string | null) ?? null,
    status: (row.status as string | null) ?? null,
    blockedAt: (row.blocked_at as string | null) ?? null,
  }));

  const activeEnrollmentIds = new Set<string>();
  if (enrollments.length > 0) {
    const { data: lessonRows, error: lessonError } = await db
      .from("lms_lessons")
      .select("id")
      .in("course_id", courseIds);
    if (lessonError) throw new Error(`lms_audience_lessons_failed:${lessonError.message}`);
    const lessonIds = (lessonRows ?? []).map((row) => row.id as string);

    if (lessonIds.length > 0) {
      const cutoff = new Date(now.getTime() - AUDIENCE_ACTIVE_DAYS * DAY_MS).toISOString();
      const { data: eventRows, error: eventError } = await db
        .from("lms_progress_events")
        .select("enrollment_id")
        .in("lesson_id", lessonIds)
        .gte("occurred_at", cutoff);
      if (eventError) throw new Error(`lms_audience_events_failed:${eventError.message}`);
      for (const row of eventRows ?? []) activeEnrollmentIds.add(row.enrollment_id as string);
    }
  }

  return foldCourseAudience({ courseIds, enrollments, activeEnrollmentIds, now });
}
