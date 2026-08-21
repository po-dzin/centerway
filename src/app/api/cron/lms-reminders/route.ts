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
 * CADENCE` picks the policy, defaulting to `daily` to match vercel.json. Under
 * `daily` the local-hour test is dropped and everyone is reminded on the run's
 * own hour; the schedule is set so that hour is morning in Kyiv, where nearly
 * all learners are. Set the variable to `hourly` and add an hourly schedule
 * (any plan that permits one, or an external scheduler calling this endpoint
 * with CRON_SECRET) and the designed behaviour returns with no code change.
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
