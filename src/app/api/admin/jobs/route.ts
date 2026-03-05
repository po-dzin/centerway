import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import { parseLimitOffset, requireAdminSession, serverErrorResponse, unauthorizedResponse } from "@/lib/api/adminRoute";

export async function GET(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "";
    const type = searchParams.get("type") ?? "";
    const q = searchParams.get("q")?.trim() ?? "";
    const { limit, offset } = parseLimitOffset(searchParams, { defaultLimit: 50, maxLimit: 200 });

    const db = adminClient();

    let query = db
        .from("jobs")
        .select(`*`, { count: "exact" })
        .range(offset, offset + limit - 1)
        .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);
    if (type) query = query.eq("type", type);
    if (q) query = query.or(`error_text.ilike.%${q}%,payload::text.ilike.%${q}%`);

    const { data, error, count } = await query;
    if (error) return serverErrorResponse(error.message);

    return NextResponse.json({ data: data ?? [], count: count ?? 0 });
}
