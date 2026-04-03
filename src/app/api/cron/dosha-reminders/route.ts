import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron/auth";
import { enqueueDoshaReminderJobs } from "@/lib/doshaReminder";
import { processPendingJobs } from "@/lib/jobs/worker";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  try {
    const enqueued = await enqueueDoshaReminderJobs(200);
    const processedCount = await processPendingJobs(200);
    return NextResponse.json({ success: true, enqueued, processedCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
