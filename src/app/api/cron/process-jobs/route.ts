import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/errors";
import { processPendingJobs } from "@/lib/jobs/worker";
import { requireCronAuth } from "@/lib/cron/auth";

export async function GET(req: Request) {
    const authError = requireCronAuth(req);
    if (authError) {
        return authError;
    }

    try {
        const processedCount = await processPendingJobs(100);
        return NextResponse.json({ success: true, processedCount });
    } catch (e) {
        console.error("Cron failed:", e);
        return NextResponse.json({ success: false, error: errorMessage(e) }, { status: 500 });
    }
}
