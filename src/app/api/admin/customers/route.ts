import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import { requireAdmin } from "@/lib/auth/requireAdmin";

// GET /api/admin/customers?q=...&limit=...&offset=...
export async function GET(req: NextRequest) {
    const session = await requireAdmin(req);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);
    const offset = Number(searchParams.get("offset") ?? 0);

    const db = adminClient();

    if (q) {
        // Search directly on the flat customers table
        const { data: direct, count: directCount, error } = await db
            .from("customers")
            .select("id, email, phone, display_name, avatar_url, tags, created_at, tg_id, google_id", { count: "exact" })
            .or(`email.ilike.%${q}%,phone.ilike.%${q}%,display_name.ilike.%${q}%,tg_id.ilike.%${q}%,google_id.ilike.%${q}%`)
            .range(offset, offset + limit - 1)
            .order("created_at", { ascending: false });

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ data: direct ?? [], count: directCount ?? 0 });
    }

    // No query — latest customers
    const { data, error, count } = await db
        .from("customers")
        .select("id, email, phone, display_name, avatar_url, tags, created_at, tg_id, google_id", { count: "exact" })
        .range(offset, offset + limit - 1)
        .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data ?? [], count: count ?? 0 });
}
