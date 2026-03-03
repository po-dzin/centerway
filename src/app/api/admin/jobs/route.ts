import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export async function GET(req: NextRequest) {
    const session = await requireAdmin(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "";
    const type = searchParams.get("type") ?? "";
    const q = searchParams.get("q")?.trim() ?? "";
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
    const offset = Number(searchParams.get("offset") ?? 0);

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
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data: data ?? [], count: count ?? 0 });
}
