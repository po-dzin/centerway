/**
 * Hourly learner reminders.
 *
 * Runs every hour by design: each learner is nudged at the reminder hour on
 * THEIR clock, so a single daily run at a Kyiv hour would be wrong for everyone
 * outside that zone (docs/lms-research-2026-08-15.md §3A.4).
 *
 * Two independent passes, because they answer different questions:
 *   - daily     — "today's step is waiting" (driven by enrollments)
 *   - unstarted — "you own a course you have never opened" (driven by orders)
 * The second exists because a learner who never opened the course has no
 * enrollment row, and so was invisible to the first.
 */

import { NextResponse } from "next/server";

import { requireCronAuth } from "@/lib/cron/auth";
import { runDailyReminders, runUnstartedReminders } from "@/lib/lms/reminders";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  try {
    // Sequential, not parallel: both passes write through the same service-role
    // client and one failing must not leave the other half-run and unreported.
    const daily = await runDailyReminders(500);
    const unstarted = await runUnstartedReminders(500);

    return NextResponse.json({ success: true, daily, unstarted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
