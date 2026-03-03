import { NextResponse } from "next/server";
import { processPendingJobs } from "@/lib/jobs/worker";

// Secret check so random people can't trigger cron
const CRON_SECRET = process.env.CRON_SECRET || "local-cron-secret";

export async function GET(req: Request) {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.split(" ")[1];

    if (token !== CRON_SECRET) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const processedCount = await processPendingJobs(20);
        return NextResponse.json({ success: true, processedCount });
    } catch (e: any) {
        console.error("Cron failed:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
