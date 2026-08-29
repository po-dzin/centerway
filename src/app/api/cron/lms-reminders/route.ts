/**
 * Learner reminders.
 *
 * Two independent passes, because they answer different questions:
 *   - daily     — "today's step is waiting" (driven by enrollments)
 *   - unstarted — "you own a course you have never opened" (driven by orders)
 * The second exists because a learner who never opened the course has no
 * enrollment row, and so was invisible to the first.
 *
 * CADENCE. The design is hourly, so each learner is nudged at the reminder hour
 * on THEIR clock (docs/lms-research-2026-08-15.md §3A.4). The plan we deploy on
 * allows daily crons only, and for a while the answer to that was to unschedule
 * the job entirely rather than serve one timezone badly — which meant way21's
 * whole day-N rhythm was computed and never delivered.
 *
 * That trade is now made explicitly and in the other direction: `LMS_REMINDER_
 * CADENCE` picks the policy, defaulting to `daily`. Under `daily` the local-hour
 * test is dropped and everyone is reminded on the run's own hour; the schedule
 * is set so that hour is morning in Kyiv, where nearly all learners are.
 *
 * THE CONSTRAINT ABOVE NO LONGER BINDS (2026-08-29). Scheduling moved off the
 * Vercel plan and into pg_cron — the "external scheduler calling this endpoint
 * with CRON_SECRET" that this comment named as the escape hatch is now what
 * actually fires it (docs/migration/sql/2026-08-29_pg_cron_scheduler.sql), and
 * it has minute granularity. So `hourly` costs setting `LMS_REMINDER_CADENCE=
 * hourly` and changing one schedule in `cron.job`. It is left on `daily`
 * because WHEN to message learners is a product decision, not a scheduling
 * one — but it is now a decision rather than a limitation.
 *
 * What is NOT given up: the day number. Which day of the course a learner is on
 * is still computed in their own timezone under either policy — only the hour of
 * delivery is coarse.
 */

import { NextResponse } from "next/server";

import { requireCronAuth } from "@/lib/cron/auth";
import { runDailyReminders, runUnstartedReminders } from "@/lib/lms/reminders";
import type { ReminderHourPolicy } from "@/lms-core";

export const runtime = "nodejs";

function hourPolicy(): ReminderHourPolicy {
  return process.env.LMS_REMINDER_CADENCE === "hourly" ? "learner-local" : "single-daily-run";
}

export async function GET(req: Request) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  const policy = hourPolicy();

  try {
    // Sequential, not parallel: both passes write through the same service-role
    // client and one failing must not leave the other half-run and unreported.
    const daily = await runDailyReminders(500, new Date(), policy);
    const unstarted = await runUnstartedReminders(500, new Date(), policy);

    return NextResponse.json({ success: true, policy, daily, unstarted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ success: false, policy, error: message }, { status: 500 });
  }
}
