import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import { parseLimitOffset, requireAdminSession, serverErrorResponse, unauthorizedResponse } from "@/lib/api/adminRoute";

export async function GET(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const { limit, offset } = parseLimitOffset(searchParams, { defaultLimit: 50, maxLimit: 200 });

    const db = adminClient();
    const { data, error, count } = await db
        .from("audit_log")
        .select("*", { count: "exact" })
        .range(offset, offset + limit - 1)
        .order("created_at", { ascending: false });

    if (error) return serverErrorResponse(error.message);

    return NextResponse.json({
        items: data ?? [],
        total: count ?? 0,
        limit,
        offset,
    });
}
