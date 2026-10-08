import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/errors";
import { processPendingJobs } from "@/lib/jobs/worker";
import { requireCronAuth } from "@/lib/cron/auth";
import { runWelcomeEmails } from "@/lib/email/lifecycleRuns";

export async function GET(req: Request) {
  const authError = requireCronAuth(req);
  if (authError) {
    return authError;
  }

  try {
    const processedCount = await processPendingJobs(100);
    /* The welcome letter rides this five-minute tick: there is no server-side
       moment that runs once per new account (the account is born in a database
       trigger), so a short scan of recent accounts is the nearest thing. Its own
       failure must not report the job queue as failed. */
    let welcome: unknown = null;
    try {
      welcome = await runWelcomeEmails();
    } catch (error) {
      welcome = { error: errorMessage(error) };
    }
    return NextResponse.json({ success: true, processedCount, welcome });
  } catch (e) {
    console.error("Cron failed:", e);
    return NextResponse.json({ success: false, error: errorMessage(e) }, { status: 500 });
  }
}
