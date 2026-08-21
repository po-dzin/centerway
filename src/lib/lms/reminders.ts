/**
 * Day-N reminders for daily courses.
 *
 * Asks, per learner: "is today's step still undone?" — and, under the designed
 * hourly cadence, "is it the reminder hour on YOUR clock?" too.
 *
 * That second question is now the CALLER's to choose, via `hourPolicy`. On the
 * plan we deploy to, crons run once a day, and a once-a-day run that still
 * insists on each learner's local hour reminds nobody: see `ReminderHourPolicy`
 * in the core for why the hour is the part we give up rather than the day.
 *
 * Idempotency: `lms_reminder_log` is unique on (enrollment, day, channel), so a
 * retried or overlapping cron run cannot nudge the same learner twice — which
 * is also what makes a coarse cadence safe. Fire the job twice in one day and
 * the second pass claims nothing.
 */

import { adminClient } from "@/lib/auth/adminClient";
import {
  decideDailyReminder,
  decideUnstartedReminder,
  resolveTimeZone,
  type Course,
  type ReminderHourPolicy,
} from "@/lms-core";
import { listPublishedCourses } from "./catalog";
import { loadProgress } from "./server";
import { notifyLearner } from "./notify";

export type ReminderRunResult = {
  scanned: number;
  sent: number;
  skipped: Record<string, number>;
};

type EnrollmentRow = {
  id: string;
  course_id: string;
  auth_user_id: string;
  started_at: string;
};

function bump(counter: Record<string, number>, key: string): void {
  counter[key] = (counter[key] ?? 0) + 1;
}

/**
 * Pages through every row a query matches, not just the first slice.
 *
 * Both passes below used to take a single `.limit(500)` with no cursor. Under
 * an hourly cadence that was a soft cap — most courses have far fewer
 * enrollments than that between runs. Once the cron went daily (see the module
 * doc), it stopped being soft: a course past 500 enrollments has the SAME 500
 * rows returned on every run (Postgres has no ordering guarantee without an
 * ORDER BY, but in practice an unordered scan is stable run to run), so anyone
 * outside that slice is never scanned, decided for, or reminded — permanently,
 * not just "later than others". Paging removes the cap; the row count a course
 * actually has is now the only bound.
 */
async function fetchAllRows<T>(
  pageSize: number,
  // PromiseLike, not Promise: Supabase's query builder is thenable but is not
  // typed as a real Promise (same mismatch builder.ts's StructureWriter cast
  // works around) — `await` accepts either, but the parameter type has to say
  // so or every call site fails to typecheck against the builder it passes in.
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw new Error(`lms_reminders_page_failed:${error.message}`);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) return all;
    from += pageSize;
  }
}

/**
 * Courses that opt into day-N reminders at all.
 *
 * Driven by the catalog, not by a hand-kept slug list. The list used to name
 * `reset-day` alone, which quietly excluded way21 — the FIRST course to be both
 * `daily` and `published`, i.e. the first one these reminders were built for.
 * A schedule mode is a property of the course; nothing should have to be
 * remembered in a second place for it to take effect.
 */
function dailyCourseIds(): Map<string, Course> {
  const map = new Map<string, Course>();
  for (const course of listPublishedCourses()) {
    if (course.schedule.mode === "daily") {
      map.set(course.id, course);
    }
  }
  return map;
}

/**
 * Nudges buyers who paid and never opened the course.
 *
 * Scans ORDERS, not enrollments — deliberately. `ensureEnrollment` only writes
 * a row when the course is first opened, so the people this targets are exactly
 * the ones with no enrollment, and the enrollment-driven scan was structurally
 * blind to them: a purchase that never turned into a first visit produced
 * silence forever.
 *
 * Never creates an enrollment. Day 1 belongs to the learner's first visit
 * (decision 2026-08-15), and a reminder must not start a clock the learner
 * has not started themselves.
 */
export async function runUnstartedReminders(
  limit = 500,
  now = new Date(),
  hourPolicy: ReminderHourPolicy = "learner-local"
): Promise<ReminderRunResult> {
  const db = adminClient();
  const skipped: Record<string, number> = {};
  let scanned = 0;
  let sent = 0;

  for (const course of listPublishedCourses()) {
    if (course.entitlementProductCodes.length === 0) continue;

    // Paged, ascending on a column pair that is stable under concurrent
    // inserts — not `.limit(limit)` on its own, which silently re-served the
    // same newest 500 orders forever once a course passed that count and left
    // every older buyer permanently unreachable.
    const orderRows = await fetchAllRows(limit, (from, to) =>
      db
        .from("orders")
        .select("order_ref, customer_id, created_at")
        .eq("status", "paid")
        .in("product_code", course.entitlementProductCodes)
        .order("created_at", { ascending: true })
        .order("order_ref", { ascending: true })
        .range(from, to)
    );

    const orders = orderRows.filter((order) => order.order_ref && order.customer_id);
    if (orders.length === 0) continue;

    // Only buyers with a platform account can be addressed: notification
    // channels resolve through auth_user_id. A buyer who never signed in is a
    // registration problem, not a reminder one.
    const { data: customerRows } = await db
      .from("customers")
      .select("id, auth_user_id")
      .in("id", [...new Set(orders.map((order) => order.customer_id))])
      .not("auth_user_id", "is", null);

    const authByCustomer = new Map((customerRows ?? []).map((row) => [row.id, row.auth_user_id as string]));
    if (authByCustomer.size === 0) continue;

    const orderRefs = orders.map((order) => order.order_ref as string);
    const authUserIds = [...new Set([...authByCustomer.values()])];

    const [{ data: enrolled }, { data: tokens }, { data: alreadySent }] = await Promise.all([
      db.from("lms_enrollments").select("auth_user_id").eq("course_id", course.id).in("auth_user_id", authUserIds),
      db.from("access_tokens").select("order_ref, expires_at").in("order_ref", orderRefs),
      db
        .from("lms_unstarted_reminders")
        .select("order_ref, nudge_number")
        .eq("course_id", course.id)
        .in("order_ref", orderRefs),
    ]);

    const startedAlready = new Set((enrolled ?? []).map((row) => row.auth_user_id as string));
    const expiredOrders = new Set(
      (tokens ?? [])
        .filter((token) => token.expires_at && new Date(token.expires_at).getTime() < now.getTime())
        .map((token) => token.order_ref as string)
    );

    const sentByOrder = new Map<string, number[]>();
    for (const row of alreadySent ?? []) {
      const key = row.order_ref as string;
      sentByOrder.set(key, [...(sentByOrder.get(key) ?? []), row.nudge_number as number]);
    }

    // One purchase per learner per course is enough to nudge about; a learner
    // who bought twice must not be messaged twice in the same run.
    const handledUsers = new Set<string>();

    for (const order of orders) {
      const orderRef = order.order_ref as string;
      const authUserId = authByCustomer.get(order.customer_id as string);
      if (!authUserId) continue;

      scanned += 1;

      if (startedAlready.has(authUserId)) {
        bump(skipped, "already_started");
        continue;
      }
      if (handledUsers.has(authUserId)) {
        bump(skipped, "duplicate_order");
        continue;
      }
      if (expiredOrders.has(orderRef)) {
        bump(skipped, "access_expired");
        continue;
      }

      const { data: profile } = await db
        .from("platform_users")
        .select("timezone")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      const decision = decideUnstartedReminder(course, {
        purchasedAt: new Date(order.created_at ?? now.toISOString()),
        timeZone: resolveTimeZone(profile?.timezone),
        now,
        sentNudgeNumbers: sentByOrder.get(orderRef) ?? [],
        hourPolicy,
      });

      if (!decision.send) {
        bump(skipped, decision.reason);
        continue;
      }

      // Claim BEFORE sending: a crash after delivery must not re-nudge.
      const claim = await db.from("lms_unstarted_reminders").insert({
        order_ref: orderRef,
        course_id: course.id,
        auth_user_id: authUserId,
        nudge_number: decision.nudgeNumber,
        channel: "telegram",
      });

      if (claim.error) {
        bump(skipped, claim.error.code === "23505" ? "already_sent" : "claim_failed");
        continue;
      }

      handledUsers.add(authUserId);

      const result = await notifyLearner({
        authUserId,
        text:
          decision.nudgeNumber === 1
            ? `«${course.title}» вже відкритий у вашому кабінеті. Перший урок можна пройти тоді, коли буде зручно.`
            : `Нагадуємо: «${course.title}» чекає в кабінеті. Проходження рахується від першого відкриття, тож нічого не згоріло.`,
        href: `/learn/${course.slug}`,
      });

      if (result.delivered) {
        sent += 1;
      } else {
        // Release the claim so an unreachable learner is not skipped forever.
        await db
          .from("lms_unstarted_reminders")
          .delete()
          .eq("order_ref", orderRef)
          .eq("nudge_number", decision.nudgeNumber)
          .eq("channel", "telegram");
        handledUsers.delete(authUserId);
        bump(skipped, `undelivered:${result.reason}`);
      }
    }
  }

  return { scanned, sent, skipped };
}

export async function runDailyReminders(
  limit = 500,
  now = new Date(),
  hourPolicy: ReminderHourPolicy = "learner-local"
): Promise<ReminderRunResult> {
  const db = adminClient();
  const courses = dailyCourseIds();
  const skipped: Record<string, number> = {};

  if (courses.size === 0) {
    return { scanned: 0, sent: 0, skipped: { no_daily_courses: 1 } };
  }

  // Paged the same way, on the enrollment's own id: without an ORDER BY a
  // `.limit()` has no contract to return the same rows twice, so a course past
  // the cap could return a DIFFERENT arbitrary 500 each run — scanning some
  // learners repeatedly while others were never reached at all.
  const enrollments = await fetchAllRows<EnrollmentRow>(limit, (from, to) =>
    db
      .from("lms_enrollments")
      .select("id, course_id, auth_user_id, started_at")
      .in("course_id", [...courses.keys()])
      .order("id", { ascending: true })
      .range(from, to)
  );
  let sent = 0;

  for (const enrollment of enrollments) {
    const course = courses.get(enrollment.course_id);
    if (!course) continue;

    const { data: profile } = await db
      .from("platform_users")
      .select("timezone")
      .eq("auth_user_id", enrollment.auth_user_id)
      .maybeSingle();

    const timeZone = resolveTimeZone(profile?.timezone);
    const progress = await loadProgress(enrollment.id);

    const decision = decideDailyReminder(course, progress, {
      startedAt: new Date(enrollment.started_at),
      timeZone,
      now,
      hourPolicy,
    });

    if (!decision.send) {
      bump(skipped, decision.reason);
      continue;
    }

    // Claim the slot BEFORE sending: a crash after delivery must not re-send.
    const claim = await db.from("lms_reminder_log").insert({
      enrollment_id: enrollment.id,
      lesson_id: decision.lesson.id,
      day_number: decision.dayNumber,
      channel: "telegram",
    });

    if (claim.error) {
      // 23505 = already reminded for this day.
      bump(skipped, claim.error.code === "23505" ? "already_sent" : "claim_failed");
      continue;
    }

    const result = await notifyLearner({
      authUserId: enrollment.auth_user_id,
      text: `День ${decision.dayNumber}: ${decision.lesson.title}. Урок готовий — заходьте, коли буде зручно.`,
      href: `/learn/${course.slug}/${decision.lesson.slug}`,
    });

    if (result.delivered) {
      sent += 1;
    } else {
      // Release the claim so the learner is not silently skipped forever.
      await db
        .from("lms_reminder_log")
        .delete()
        .eq("enrollment_id", enrollment.id)
        .eq("day_number", decision.dayNumber)
        .eq("channel", "telegram");
      bump(skipped, `undelivered:${result.reason}`);
    }
  }

  return { scanned: enrollments.length, sent, skipped };
}
