import { NextRequest, NextResponse } from "next/server";

import { listJobs } from "@/lib/admin/jobs";
import { parseLimitOffset, requireAdminSession, serverErrorResponse, unauthorizedResponse } from "@/lib/api/adminRoute";

export async function GET(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const { limit, offset } = parseLimitOffset(searchParams, { defaultLimit: 50, maxLimit: 200 });
    try {
        return NextResponse.json(
            await listJobs({
                q: searchParams.get("q") ?? "",
                status: searchParams.get("status") ?? "",
                type: searchParams.get("type") ?? "",
                limit,
                offset,
            })
        );
    } catch (error) {
        return serverErrorResponse(error instanceof Error ? error.message : "jobs_failed");
    }
}
