import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

async function requireAdmin(req: NextRequest) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return null;
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } }
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;

    const db = adminClient();
    const { data, error: roleError } = await db.from("user_roles").select("role").eq("user_id", user.id).single();
    if (!data || !["admin", "support", "Admin", "Support"].includes(data.role)) return null;
    return { user };
}

function adminClient() {
    return createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );
}

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
