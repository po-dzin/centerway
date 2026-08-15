/**
 * Hourly day-N reminders for daily courses.
 *
 * Runs every hour by design: each learner is nudged at the reminder hour on
 * THEIR clock, so a single daily run at a Kyiv hour would be wrong for everyone
 * outside that zone (docs/lms-research-2026-08-15.md §3A.4).
 */

import { NextResponse } from "next/server";

import { requireCronAuth } from "@/lib/cron/auth";
import { runDailyReminders } from "@/lib/lms/reminders";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  try {
    const result = await runDailyReminders(500);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
