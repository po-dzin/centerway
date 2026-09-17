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
 * enrollment id: the API above it returns integers and shares per course, and
 * one daily series of how many distinct people opened anything. Account ids are
 * read only to deduplicate that series and never leave this module.
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
import { foldProgress, type ProgressEvent, type ProgressEventType } from "@/lms-core/progress";

export type CourseAudience = {
  /** People whose access is open right now. */
  learners: number;
  /** People who were enrolled and whose access has since closed. */
  lapsed: number;
  /** Of the open ones, how many arrived inside the recent window. */
  joinedRecently: number;
  /** How many distinct open learners produced a progress event in the active window. */
  activeRecently: number;
  /** Open learners with no progress event at all — given access, never opened a lesson. */
  notStarted: number;
  /** Open learners who have completed every lesson the course has now. */
  finished: number;
  /** Lesson completions by open learners inside the active window. */
  completionsRecently: number;
  /**
   * Mean share of the course's current lessons completed, over open learners,
   * 0..1. `null` when there is nobody to average or nothing to complete — a
   * course without learners has no progress, not a progress of zero.
   */
  progressShare: number | null;
};

/** One Kyiv calendar day and the distinct people who opened anything in it. */
export type AudienceDay = { date: string; learners: number };

export type AuthorAudience = {
  courses: Map<string, CourseAudience>;
  /** Oldest first, exactly `AUDIENCE_SERIES_DAYS` long, zero-filled. */
  days: AudienceDay[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** «Нових» is a month; a shorter window reads as noise on a course sold weekly. */
export const AUDIENCE_JOINED_DAYS = 30;
/** «Активних» is a week — the span an author plans a cohort in. */
export const AUDIENCE_ACTIVE_DAYS = 7;
/** The activity chart's span — the same month as «нових». */
export const AUDIENCE_SERIES_DAYS = 30;
/** The platform's audience lives in Kyiv time; a day is that calendar day. */
const AUDIENCE_TIME_ZONE = "Europe/Kyiv";

const kyivDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: AUDIENCE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type AudienceEnrollmentRow = {
  id: string;
  courseId: string;
  /** Read only to count a person once per day across courses. Never returned. */
  userId: string;
  startedAt: string | null;
  expiresAt: string | null;
  status: string | null;
  blockedAt: string | null;
};

export type AudienceEventRow = {
  enrollmentId: string;
  lessonId: string;
  type: string;
  clientId: string;
  occurredAt: string;
};

export function emptyAudience(): CourseAudience {
  return {
    learners: 0,
    lapsed: 0,
    joinedRecently: 0,
    activeRecently: 0,
    notStarted: 0,
    finished: 0,
    completionsRecently: 0,
    progressShare: null,
  };
}

/** The last `count` Kyiv calendar days ending today, oldest first. */
export function audienceDayKeys(now: Date, count: number = AUDIENCE_SERIES_DAYS): string[] {
  /* Stepped on the calendar key, not on the clock: subtracting 24 hours from a
     Kyiv instant skips or repeats a day across a DST change. */
  const today = Date.parse(`${kyivDay.format(now)}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) =>
    new Date(today - (count - 1 - index) * DAY_MS).toISOString().slice(0, 10),
  );
}

/**
 * The whole count, as arithmetic — no database, so the rules are testable.
 *
 * Progress is folded per enrollment with the player's own `foldProgress`, so
 * «завершено» here means exactly what it means to the learner, uncompletions
 * included. Only lessons the course has NOW count: a lesson the author deleted
 * is not a step anybody can still finish.
 */
export function foldAuthorAudience(input: {
  courseIds: string[];
  enrollments: AudienceEnrollmentRow[];
  events: AudienceEventRow[];
  lessonsByCourse: Map<string, Set<string>>;
  now: Date;
}): AuthorAudience {
  const nowMs = input.now.getTime();
  const joinedCutoff = nowMs - AUDIENCE_JOINED_DAYS * DAY_MS;
  const activeCutoff = nowMs - AUDIENCE_ACTIVE_DAYS * DAY_MS;
  const courses = new Map<string, CourseAudience>(input.courseIds.map((id) => [id, emptyAudience()]));
  const progressSums = new Map<string, number>();

  const eventsByEnrollment = new Map<string, AudienceEventRow[]>();
  for (const event of input.events) {
    const list = eventsByEnrollment.get(event.enrollmentId);
    if (list) list.push(event);
    else eventsByEnrollment.set(event.enrollmentId, [event]);
  }

  const dayKeys = audienceDayKeys(input.now);
  const firstDay = dayKeys[0] ?? "";
  const peopleByDay = new Map<string, Set<string>>(dayKeys.map((key) => [key, new Set<string>()]));

  for (const row of input.enrollments) {
    const entry = courses.get(row.courseId);
    // A row for a course this caller did not ask about is not this caller's
    // business, even inside a service-role read.
    if (!entry) continue;
    const events = eventsByEnrollment.get(row.id) ?? [];

    /* THE CHART IS HISTORY, the counters are the present. A learner whose
       access closed last week really did read on the days they read, so the
       daily series keeps them; the counters below count open seats only. */
    const seenClientIds = new Set<string>();
    for (const event of events) {
      const at = Date.parse(event.occurredAt);
      if (!Number.isFinite(at)) continue;
      const key = kyivDay.format(new Date(at));
      if (key >= firstDay) peopleByDay.get(key)?.add(row.userId);
    }

    const open = isAccessOpen({ status: row.status, blockedAt: row.blockedAt, expiresAt: row.expiresAt }, input.now);
    if (!open) {
      entry.lapsed += 1;
      continue;
    }

    entry.learners += 1;
    const started = row.startedAt ? Date.parse(row.startedAt) : Number.NaN;
    if (Number.isFinite(started) && started >= joinedCutoff) entry.joinedRecently += 1;

    if (events.length === 0) {
      entry.notStarted += 1;
    } else {
      let active = false;
      for (const event of events) {
        const at = Date.parse(event.occurredAt);
        if (!Number.isFinite(at) || at < activeCutoff) continue;
        /* ACTIVITY IS COUNTED ONLY FOR OPEN SEATS, so «42 учні · 7 активних»
           never says more people were active than are enrolled. */
        active = true;
        // A retried flush writes the same client id twice; it is one completion.
        if (event.type === "lesson.completed" && !seenClientIds.has(event.clientId)) {
          seenClientIds.add(event.clientId);
          entry.completionsRecently += 1;
        }
      }
      if (active) entry.activeRecently += 1;
    }

    const lessons = input.lessonsByCourse.get(row.courseId);
    if (lessons && lessons.size > 0) {
      const progress = foldProgress(
        events.map((event): ProgressEvent => ({
          clientId: event.clientId,
          type: event.type as ProgressEventType,
          lessonId: event.lessonId,
          occurredAt: event.occurredAt,
          payload: {},
        })),
      );
      const done = progress.completedLessonIds.filter((id) => lessons.has(id)).length;
      progressSums.set(row.courseId, (progressSums.get(row.courseId) ?? 0) + done / lessons.size);
      if (done === lessons.size) entry.finished += 1;
    }
  }

  for (const [courseId, entry] of courses) {
    const lessons = input.lessonsByCourse.get(courseId);
    entry.progressShare =
      entry.learners > 0 && lessons && lessons.size > 0 ? (progressSums.get(courseId) ?? 0) / entry.learners : null;
  }

  return {
    courses,
    days: dayKeys.map((date) => ({ date, learners: peopleByDay.get(date)?.size ?? 0 })),
  };
}

/** PostgREST caps a response at 1000 rows; a count that silently stops there is wrong. */
const PAGE_SIZE = 1000;
/** Ids per `.in()` — keeps the request URL well inside proxy limits. */
const ID_CHUNK = 150;

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

/**
 * The three reads behind that fold: seats, the course's current lessons, and
 * every progress event those seats have written. Paged, because the event log
 * is the one table here that grows with reading rather than with selling.
 */
export async function readAuthorAudience(courseIds: string[], now: Date = new Date()): Promise<AuthorAudience> {
  if (courseIds.length === 0)
    return foldAuthorAudience({ courseIds, enrollments: [], events: [], lessonsByCourse: new Map(), now });
  const db = adminClient();

  const { data: enrollmentRows, error: enrollmentError } = await db
    .from("lms_enrollments")
    .select("id, course_id, auth_user_id, started_at, expires_at, status, blocked_at")
    .in("course_id", courseIds);
  if (enrollmentError) throw new Error(`lms_audience_enrollments_failed:${enrollmentError.message}`);

  const enrollments: AudienceEnrollmentRow[] = (enrollmentRows ?? []).map((row) => ({
    id: row.id,
    courseId: row.course_id,
    userId: row.auth_user_id,
    startedAt: row.started_at ?? null,
    expiresAt: row.expires_at ?? null,
    status: row.status ?? null,
    blockedAt: row.blocked_at ?? null,
  }));

  const { data: lessonRows, error: lessonError } = await db
    .from("lms_lessons")
    .select("id, course_id")
    .in("course_id", courseIds);
  if (lessonError) throw new Error(`lms_audience_lessons_failed:${lessonError.message}`);
  const lessonsByCourse = new Map<string, Set<string>>();
  for (const row of lessonRows ?? []) {
    const set = lessonsByCourse.get(row.course_id) ?? new Set<string>();
    set.add(row.id);
    lessonsByCourse.set(row.course_id, set);
  }

  const events: AudienceEventRow[] = [];
  for (const ids of chunks(
    enrollments.map((row) => row.id),
    ID_CHUNK,
  )) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await db
        .from("lms_progress_events")
        .select("id, enrollment_id, lesson_id, type, client_id, occurred_at")
        .in("enrollment_id", ids)
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`lms_audience_events_failed:${error.message}`);
      for (const row of data ?? []) {
        events.push({
          enrollmentId: row.enrollment_id,
          lessonId: row.lesson_id,
          type: row.type,
          clientId: row.client_id,
          occurredAt: row.occurred_at,
        });
      }
      if ((data ?? []).length < PAGE_SIZE) break;
    }
  }

  return foldAuthorAudience({ courseIds, enrollments, events, lessonsByCourse, now });
}
