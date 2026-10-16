/**
 * ОГОЛОШЕННЯ АВТОРА (L1): one note from the author to everyone with open access
 * to the course (docs/author-learner-contact-2026-09-09.md; mockup approved by
 * G on 2026-10-15). Schema: migration 20261015210000_course_announcements.sql.
 *
 * ONE WAY, AND NOBODY'S NAME CROSSES. The author writes; learners receive. The
 * author is told how many received it, how many got it in Telegram and how many
 * opened the course since — never who. Nothing here reads a name, an email or a
 * Telegram handle on the author's behalf.
 *
 * WHERE IT ARRIVES. Every recipient gets a `learner_notices` row. That row is
 * the course's «Від автора» block, the «Нове від автора» mark on the course card
 * in Бібліотека, and the Telegram card, which is sent through `notifyLearner` —
 * the same bot and card the reminders use, so no second subscription exists.
 * Opening the course marks the row read; the Telegram button opens the course,
 * so one message never shows up as unread in the second place.
 *
 * WHO RECEIVES. Open access, read the way the reminders read it: an enrollment
 * that is neither blocked, revoked nor expired, plus a paid buyer of the
 * course's OWN codes (`loadOwnCodes`) who has never opened it. A bundle buyer
 * whose cohort merely carries this course in is not addressed by its author.
 *
 * WHO SENDS. The publish request sends the first batch after it answers
 * (`after`), and a `jobs` row carries the rest on the five-minute tick. Both
 * claim rows by flipping `pending → sending` in one update, so the two never
 * message the same person twice.
 */

import { adminClient } from "@/lib/auth/adminClient";
import { loadOwnCodes } from "@/lib/experiences/openingCodes";
import { accessStateOf, courseOfferCode, type Course } from "@/lms-core";
import { getCourseAuthor } from "./authors";
import { notifyLearner } from "./notify";

export const ANNOUNCEMENT_MAX_LENGTH = 1000;
/** One announcement per course per this window — the author's attention is the learner's too. */
export const ANNOUNCEMENT_COOLDOWN_MS = 24 * 3600 * 1000;
export const ANNOUNCEMENT_JOB = "lms:announcement-telegram";

const SEND_BATCH = 60;
/** A `sending` claim older than this belonged to a request that died; it is taken again. */
const STALE_CLAIM_MS = 15 * 60 * 1000;

export class AnnouncementError extends Error {
  constructor(
    readonly code: string,
    readonly status = 422,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = "AnnouncementError";
  }
}

export type AnnouncementSummary = {
  id: string;
  body: string;
  lessonSlug: string | null;
  lessonTitle: string | null;
  createdAt: string;
  recipients: number;
  telegram: number;
  read: number;
  /** Still being sent: rows not yet answered by Telegram. */
  pending: number;
};

export type AnnouncementReach = { recipients: number; telegram: number };

export type LearnerAnnouncement = {
  id: string;
  body: string;
  createdAt: string;
  lessonSlug: string | null;
  lessonTitle: string | null;
  unread: boolean;
};

/* ─────────────────────────── pure ─────────────────────────── */

/** Trimmed text with runs of blank lines folded to one, or null when there is nothing to send. */
export function normalizeAnnouncementBody(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text || text.length > ANNOUNCEMENT_MAX_LENGTH) return null;
  return text;
}

/** When the author may write again, or null when they may now. */
export function nextAnnouncementAt(lastCreatedAt: string | null, now: Date): string | null {
  if (!lastCreatedAt) return null;
  const last = Date.parse(lastCreatedAt);
  if (!Number.isFinite(last)) return null;
  const next = last + ANNOUNCEMENT_COOLDOWN_MS;
  return next > now.getTime() ? new Date(next).toISOString() : null;
}

/** Every lesson of the course, in reading order, for the button picker and for titles. */
export function courseLessonTitles(course: Pick<Course, "modules">): Map<string, string> {
  const titles = new Map<string, string>();
  for (const courseModule of course.modules)
    for (const lesson of courseModule.lessons) titles.set(lesson.slug, lesson.title);
  return titles;
}

/** The address the Telegram button and the course block lead to. */
export function announcementHref(courseSlug: string, lessonSlug: string | null): string {
  return lessonSlug ? `/learn/${courseSlug}/${lessonSlug}` : `/learn/${courseSlug}`;
}

/* ─────────────────────────── audience ─────────────────────────── */

type Db = ReturnType<typeof adminClient>;

async function readAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(`lms_announcement_audience_failed:${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

/**
 * Who hears the announcement: account ids of everyone with open access right
 * now, and the customer ids of paid buyers who never signed in but whose
 * Telegram the bot already knows — they are reached there, by the customer row.
 */
export type AnnouncementAudience = { accounts: string[]; guests: string[] };

export async function readAnnouncementAudience(
  db: Db,
  course: Pick<Course, "id" | "slug" | "entitlementProductCodes">,
  now: Date = new Date(),
): Promise<AnnouncementAudience> {
  const enrollments = await readAll<{
    auth_user_id: string;
    status: string;
    blocked_at: string | null;
    expires_at: string | null;
  }>((from, to) =>
    db
      .from("lms_enrollments")
      .select("auth_user_id, status, blocked_at, expires_at")
      .eq("course_id", course.id)
      .order("auth_user_id", { ascending: true })
      .range(from, to),
  );

  const enrolled = new Set<string>();
  const open = new Set<string>();
  for (const row of enrollments) {
    enrolled.add(row.auth_user_id);
    const state = accessStateOf({ status: row.status, blockedAt: row.blocked_at, expiresAt: row.expires_at }, now);
    if (state === "active") open.add(row.auth_user_id);
  }

  const own = await loadOwnCodes(db, [course]);
  const codes = [...new Set([...(own.get(course.id) ?? []), courseOfferCode(course.slug)])];
  const orders = await readAll<{ customer_id: string | null }>((from, to) =>
    db
      .from("orders")
      .select("customer_id")
      .eq("status", "paid")
      .in("product_code", codes)
      .order("order_ref", { ascending: true })
      .range(from, to),
  );
  const customerIds = [...new Set(orders.map((order) => order.customer_id).filter((id): id is string => Boolean(id)))];
  const guestByChat = new Map<string, string>();
  for (let i = 0; i < customerIds.length; i += 500) {
    const { data, error } = await db
      .from("customers")
      .select("id, auth_user_id, tg_id")
      .in("id", customerIds.slice(i, i + 500));
    if (error) throw new Error(`lms_announcement_audience_failed:${error.message}`);
    for (const row of data ?? []) {
      const id = row.auth_user_id as string | null;
      if (id) {
        // An enrollment, when there is one, has the last word: a blocked or
        // expired learner is not re-admitted to the author's notes by an old order.
        if (!enrolled.has(id)) open.add(id);
      } else if (row.tg_id !== null && row.tg_id !== undefined) {
        guestByChat.set(String(row.tg_id), row.id as string);
      }
    }
  }

  /* A chat that also belongs to an account is that account's to decide: it is
     either in the audience already or was left out on purpose (blocked,
     expired). Either way the guest row must not send it a second time. */
  const chats = [...guestByChat.keys()];
  for (let i = 0; i < chats.length; i += 500) {
    const { data, error } = await db
      .from("customers")
      .select("tg_id")
      .in("tg_id", chats.slice(i, i + 500))
      .not("auth_user_id", "is", null);
    if (error) throw new Error(`lms_announcement_audience_failed:${error.message}`);
    for (const row of data ?? []) guestByChat.delete(String(row.tg_id));
  }
  return { accounts: [...open], guests: [...new Set(guestByChat.values())] };
}

/** How many will receive it, and how many of them can be reached in Telegram. */
export async function readAnnouncementReach(
  course: Pick<Course, "id" | "slug" | "entitlementProductCodes">,
): Promise<AnnouncementReach> {
  const db = adminClient();
  const { accounts, guests } = await readAnnouncementAudience(db, course);
  let telegram = 0;
  for (let i = 0; i < accounts.length; i += 500) {
    const { count } = await db
      .from("customers")
      .select("id", { count: "exact", head: true })
      .in("auth_user_id", accounts.slice(i, i + 500))
      .not("tg_id", "is", null);
    telegram += count ?? 0;
  }
  // Every guest is in the audience because the bot knows their chat.
  return {
    recipients: accounts.length + guests.length,
    telegram: Math.min(telegram, accounts.length) + guests.length,
  };
}

/* ─────────────────────────── author side ─────────────────────────── */

export async function listCourseAnnouncements(course: Pick<Course, "id" | "modules">): Promise<AnnouncementSummary[]> {
  const db = adminClient();
  const { data, error } = await db
    .from("lms_announcements")
    .select("id, body, lesson_slug, created_at, recipients")
    .eq("course_id", course.id)
    .is("hidden_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(`lms_announcements_read_failed:${error.message}`);
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const { data: notices, error: noticeError } = await db
    .from("learner_notices")
    .select("announcement_id, tg_status, read_at")
    .in(
      "announcement_id",
      rows.map((row) => row.id),
    );
  if (noticeError) throw new Error(`lms_announcements_read_failed:${noticeError.message}`);

  const titles = courseLessonTitles(course);
  const tally = new Map<string, { telegram: number; read: number; pending: number }>();
  for (const notice of notices ?? []) {
    const key = notice.announcement_id as string;
    const entry = tally.get(key) ?? { telegram: 0, read: 0, pending: 0 };
    if (notice.tg_status === "sent") entry.telegram += 1;
    if (notice.tg_status === "pending" || notice.tg_status === "sending") entry.pending += 1;
    if (notice.read_at) entry.read += 1;
    tally.set(key, entry);
  }

  return rows.map((row) => {
    const entry = tally.get(row.id) ?? { telegram: 0, read: 0, pending: 0 };
    return {
      id: row.id,
      body: row.body,
      lessonSlug: row.lesson_slug,
      lessonTitle: row.lesson_slug ? (titles.get(row.lesson_slug) ?? null) : null,
      createdAt: row.created_at,
      recipients: row.recipients,
      ...entry,
    };
  });
}

/** The last announcement's time, hidden ones included: hiding one does not reopen the day. */
export async function lastAnnouncementAt(courseId: string): Promise<string | null> {
  const { data, error } = await adminClient()
    .from("lms_announcements")
    .select("created_at")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`lms_announcements_read_failed:${error.message}`);
  return data?.created_at ?? null;
}

/**
 * Writes the announcement and one notice per recipient. Sending is the caller's
 * next step (`sendAnnouncementBatch` after the response, the job after that).
 */
export async function createAnnouncement(input: {
  course: Course;
  createdBy: string;
  body: unknown;
  lessonSlug: unknown;
  now?: Date;
}): Promise<{ id: string; recipients: number }> {
  const now = input.now ?? new Date();
  const body = normalizeAnnouncementBody(input.body);
  if (!body) throw new AnnouncementError("lms_announcement_body_invalid");

  let lessonSlug: string | null = null;
  if (typeof input.lessonSlug === "string" && input.lessonSlug) {
    if (!courseLessonTitles(input.course).has(input.lessonSlug)) {
      throw new AnnouncementError("lms_announcement_lesson_unknown");
    }
    lessonSlug = input.lessonSlug;
  }

  const next = nextAnnouncementAt(await lastAnnouncementAt(input.course.id), now);
  if (next) throw new AnnouncementError("lms_announcement_too_soon", 429, { nextAt: next });

  const db = adminClient();
  const { accounts, guests } = await readAnnouncementAudience(db, input.course, now);
  const recipients = accounts.length + guests.length;
  if (recipients === 0) throw new AnnouncementError("lms_announcement_no_audience");

  const { data: author } = await db
    .from("lms_courses")
    .select("author_profile_id")
    .eq("id", input.course.id)
    .maybeSingle();

  const { data: created, error } = await db
    .from("lms_announcements")
    .insert({
      course_id: input.course.id,
      author_id: (author?.author_profile_id as string | null) ?? null,
      created_by: input.createdBy,
      body,
      lesson_slug: lessonSlug,
      recipients,
    })
    .select("id, created_at")
    .single();
  if (error || !created) throw new Error(`lms_announcement_insert_failed:${error?.message ?? "no_row"}`);

  /* THE COOLDOWN, DECIDED AFTER THE WRITE. Two requests can both read «none
     today» above and both insert. Each now looks at what is really there: the
     earliest of the day's rows stands, and any later one withdraws before a
     single notice exists — so the course hears once. */
  const { data: rivals, error: rivalsError } = await db
    .from("lms_announcements")
    .select("id, created_at")
    .eq("course_id", input.course.id)
    .gt("created_at", new Date(Date.parse(created.created_at) - ANNOUNCEMENT_COOLDOWN_MS).toISOString())
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1);
  const first = rivals?.[0];
  if (rivalsError || (first && first.id !== created.id)) {
    await db.from("lms_announcements").delete().eq("id", created.id);
    if (rivalsError) throw new Error(`lms_announcement_insert_failed:${rivalsError.message}`);
    throw new AnnouncementError("lms_announcement_too_soon", 429, {
      nextAt: new Date(Date.parse(first!.created_at) + ANNOUNCEMENT_COOLDOWN_MS).toISOString(),
    });
  }

  try {
    const notices = [
      ...accounts.map((authUserId) => ({ auth_user_id: authUserId, customer_id: null as string | null })),
      ...guests.map((customerId) => ({ auth_user_id: null as string | null, customer_id: customerId })),
    ];
    for (let i = 0; i < notices.length; i += 500) {
      const { error: noticeError } = await db.from("learner_notices").insert(
        notices.slice(i, i + 500).map((notice) => ({
          ...notice,
          kind: "author_announcement",
          announcement_id: created.id,
          course_id: input.course.id,
        })),
      );
      if (noticeError) throw new Error(`lms_announcement_notices_failed:${noticeError.message}`);
    }
    await enqueueAnnouncementJob(db, created.id);
  } catch (failure) {
    /* Nothing half-made is left behind: without its job the rows past the first
       batch would wait forever, and the cooldown would refuse the retry. The
       notices go with the announcement (on delete cascade). */
    await db.from("lms_announcements").delete().eq("id", created.id);
    throw failure;
  }
  return { id: created.id, recipients };
}

async function enqueueAnnouncementJob(db: Db, announcementId: string, runAt?: Date) {
  const { error } = await db.from("jobs").insert({
    type: ANNOUNCEMENT_JOB,
    status: "pending",
    payload: { announcement_id: announcementId },
    run_at: (runAt ?? new Date()).toISOString(),
  });
  // Thrown, not logged: the caller undoes the announcement, or the worker
  // retries the job that could not hand over to the next one.
  if (error) throw new Error(`lms_announcement_job_enqueue_failed:${error.message}`);
}

/* ─────────────────────────── sending ─────────────────────────── */

/**
 * Sends one batch. Returns how many rows are still waiting, so the job knows
 * whether to put itself back on the queue. Never throws for one learner: an
 * unreachable person is a counted outcome, not a failed run.
 */
export async function sendAnnouncementBatch(announcementId: string, now: Date = new Date()): Promise<number> {
  const db = adminClient();
  const { data: announcement, error } = await db
    .from("lms_announcements")
    .select("id, body, lesson_slug, hidden_at, course_id")
    .eq("id", announcementId)
    .maybeSingle();
  if (error) throw new Error(`lms_announcement_read_failed:${error.message}`);
  if (!announcement) return 0;

  if (announcement.hidden_at) {
    // Hidden before it finished going out: whoever has not got it yet, will not.
    await db
      .from("learner_notices")
      .update({ tg_status: "failed" })
      .eq("announcement_id", announcementId)
      .in("tg_status", ["pending", "sending"]);
    return 0;
  }

  const { data: courseRow } = await db
    .from("lms_courses")
    .select("slug, title, cover")
    .eq("id", announcement.course_id)
    .maybeSingle();
  if (!courseRow) return 0;
  const courseSlug = courseRow.slug as string;
  const courseTitle = (courseRow.title as string | null) ?? "Курс";
  const cover = (courseRow.cover as { src?: string } | null)?.src ?? null;
  const author = await getCourseAuthor(courseSlug).catch(() => null);

  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS).toISOString();
  const { data: candidates } = await db
    .from("learner_notices")
    .select("id")
    .eq("announcement_id", announcementId)
    .or(`tg_status.eq.pending,and(tg_status.eq.sending,tg_sent_at.lt.${staleBefore})`)
    .limit(SEND_BATCH);
  const ids = (candidates ?? []).map((row) => row.id);
  if (ids.length > 0) {
    const { data: claimed } = await db
      .from("learner_notices")
      .update({ tg_status: "sending", tg_sent_at: now.toISOString() })
      .in("id", ids)
      .or(`tg_status.eq.pending,and(tg_status.eq.sending,tg_sent_at.lt.${staleBefore})`)
      .select("id, auth_user_id, customer_id");

    const href = announcementHref(courseSlug, announcement.lesson_slug);
    for (const notice of claimed ?? []) {
      const to = notice.auth_user_id
        ? { authUserId: notice.auth_user_id as string }
        : notice.customer_id
          ? { customerId: notice.customer_id as string }
          : null;
      if (!to) continue;
      const result = await notifyLearner({
        ...to,
        title: author?.name ? `${courseTitle} · ${author.name}` : courseTitle,
        text: announcement.body,
        href,
        actionLabel: announcement.lesson_slug ? "Відкрити урок" : "Відкрити курс",
        imageSrc: cover,
      });
      const status = result.delivered ? "sent" : result.channel === null ? "unreachable" : "failed";
      await db
        .from("learner_notices")
        .update({ tg_status: status, tg_sent_at: result.delivered ? new Date().toISOString() : null })
        .eq("id", notice.id);
    }
  }

  const { count } = await db
    .from("learner_notices")
    .select("id", { count: "exact", head: true })
    .eq("announcement_id", announcementId)
    .in("tg_status", ["pending", "sending"]);
  return count ?? 0;
}

/** The job: one batch, and the rest back on the queue. */
export async function processAnnouncementJob(payload: unknown): Promise<void> {
  const id = (payload as { announcement_id?: unknown } | null)?.announcement_id;
  if (typeof id !== "string") throw new Error("Invalid payload for lms:announcement-telegram job");
  const remaining = await sendAnnouncementBatch(id);
  if (remaining > 0) await enqueueAnnouncementJob(adminClient(), id);
}

/* ─────────────────────────── learner side ─────────────────────────── */

/** The course's announcements for this learner, newest first, with what is still unread. */
export async function listLearnerAnnouncements(
  authUserId: string,
  course: Pick<Course, "id" | "modules">,
): Promise<LearnerAnnouncement[]> {
  const db = adminClient();
  const { data: notices, error } = await db
    .from("learner_notices")
    .select("announcement_id, read_at")
    .eq("auth_user_id", authUserId)
    .eq("course_id", course.id)
    .eq("kind", "author_announcement")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(`lms_learner_notices_read_failed:${error.message}`);
  const byId = new Map((notices ?? []).map((row) => [row.announcement_id as string, row.read_at]));
  if (byId.size === 0) return [];

  const { data: rows, error: rowsError } = await db
    .from("lms_announcements")
    .select("id, body, lesson_slug, created_at")
    .in("id", [...byId.keys()])
    .is("hidden_at", null)
    .order("created_at", { ascending: false });
  if (rowsError) throw new Error(`lms_learner_notices_read_failed:${rowsError.message}`);

  const titles = courseLessonTitles(course);
  return (rows ?? []).map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    lessonSlug: row.lesson_slug,
    lessonTitle: row.lesson_slug ? (titles.get(row.lesson_slug) ?? null) : null,
    unread: !byId.get(row.id),
  }));
}

/** Opening the course is reading what the author wrote in it. */
export async function markCourseNoticesRead(authUserId: string, courseId: string): Promise<void> {
  const { error } = await adminClient()
    .from("learner_notices")
    .update({ read_at: new Date().toISOString() })
    .eq("auth_user_id", authUserId)
    .eq("course_id", courseId)
    .is("read_at", null);
  if (error) console.error("lms_learner_notices_mark_failed", { courseId, error: error.message });
}

/** Unread author notes per course id, for the marks in Бібліотека. */
export async function unreadNoticeCounts(authUserId: string): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const { data, error } = await adminClient()
    .from("learner_notices")
    .select("course_id")
    .eq("auth_user_id", authUserId)
    .is("read_at", null)
    .not("course_id", "is", null)
    .limit(500);
  if (error) {
    console.error("lms_learner_notices_count_failed", { error: error.message });
    return counts;
  }
  for (const row of data ?? []) {
    const id = row.course_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}
