import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import { processPendingJobs } from "@/lib/jobs/worker";
import { requireAdminSession, serverErrorResponse, unauthorizedResponse } from "@/lib/api/adminRoute";

export async function POST(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

    try {
        const { searchParams } = new URL(req.url);
        const refreshAnalytics = searchParams.get("refreshAnalytics") === "1";

        const processedCount = await processPendingJobs(20);

        let analyticsRefreshed = false;
        if (refreshAnalytics) {
            const db = adminClient();
            const { error } = await db.rpc("refresh_analytics_views");
            if (error) {
                console.error("Admin pulse: analytics refresh failed", error);
            } else {
                analyticsRefreshed = true;
            }
        }

        return NextResponse.json({
            success: true,
            processedCount,
            analyticsRefreshed,
            actor: session.user.id,
        });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return serverErrorResponse(message);
    }
}
