/**
 * Day-N reminders for daily courses.
 *
 * Runs HOURLY and asks, per learner: "is it the reminder hour on YOUR clock,
 * and is today's step still undone?" That is why the cron cannot be a single
 * daily job at a Kyiv hour — the same instant is morning for one learner and
 * the middle of the night for another (docs/lms-research-2026-08-15.md §3A.4).
 *
 * Idempotency: `lms_reminder_log` is unique on (enrollment, day, channel), so a
 * retried or overlapping cron run cannot nudge the same learner twice.
 */

import { adminClient } from "@/lib/auth/adminClient";
import { decideDailyReminder, resolveTimeZone, type Course } from "@/lms-core";
import { getCourse } from "./catalog";
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

/** Courses that opt into reminders at all. */
function dailyCourseIds(): Map<string, Course> {
  const map = new Map<string, Course>();
  for (const slug of ["reset-day"]) {
    const course = getCourse(slug);
    if (course && course.schedule.mode === "daily" && course.status === "published") {
      map.set(course.id, course);
    }
  }
  return map;
}

export async function runDailyReminders(limit = 500, now = new Date()): Promise<ReminderRunResult> {
  const db = adminClient();
  const courses = dailyCourseIds();
  const skipped: Record<string, number> = {};

  if (courses.size === 0) {
    return { scanned: 0, sent: 0, skipped: { no_daily_courses: 1 } };
  }

  const { data, error } = await db
    .from("lms_enrollments")
    .select("id, course_id, auth_user_id, started_at")
    .in("course_id", [...courses.keys()])
    .limit(limit);

  if (error) throw new Error(`lms_reminders_read_failed:${error.message}`);

  const enrollments = (data ?? []) as EnrollmentRow[];
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
      text: `День ${decision.dayNumber}: ${decision.lesson.title}. Крок готовий — заходь, коли буде зручно.`,
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
