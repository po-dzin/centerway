import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron/auth";
import { dispatchDueTelegramPeriodicReports } from "@/lib/reporting/analyticsReports";

export async function GET(req: Request) {
  const authError = requireCronAuth(req);
  if (authError) {
    return authError;
  }

  try {
    const result = await dispatchDueTelegramPeriodicReports();
    return NextResponse.json({ success: true, result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Analytics reports cron failed:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
