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
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return null;

    const db = adminClient();
    const { data } = await db
        .from("user_roles").select("role").eq("user_id", user.id).single();
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

// GET /api/admin/customers/[id]
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await requireAdmin(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const db = adminClient();

    // Customer record with all flat fields (email, phone, tg_id, google_id)
    const { data: customer, error: cErr } = await db
        .from("customers")
        .select("*")
        .eq("id", id)
        .single();

    if (cErr || !customer) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Orders for this customer
    const { data: orders } = await db
        .from("orders")
        .select("id, order_ref, product_code, amount, currency, status, created_at")
        .eq("customer_id", id)
        .order("created_at", { ascending: false });

    // Events for this customer
    const { data: events } = await db
        .from("events")
        .select("id, type, order_ref, payload, created_at")
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .limit(50);

    // Build unified timeline
    const timeline = [
        ...(orders ?? []).map((o: any) => ({
            ts: o.created_at,
            type: "order" as const,
            label: `Заказ ${o.order_ref} — ${o.status}`,
            sub: o.amount ? `${o.amount} ${o.currency ?? ""}`.trim() : null,
            id: o.id,
            ref: o.order_ref,
        })),
        ...(events ?? []).map((e: any) => ({
            ts: e.created_at,
            type: "event" as const,
            label: e.type,
            sub: e.order_ref ?? null,
            id: e.id,
        })),
    ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

    return NextResponse.json({
        customer,
        orders: orders ?? [],
        events: events ?? [],
        timeline,
    });
}

// PATCH /api/admin/customers/[id]
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await requireAdmin(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const allowed = ["display_name", "tags", "notes", "avatar_url", "tg_id", "email", "phone"];
    const patch = Object.fromEntries(
        Object.entries(body).filter(([k]) => allowed.includes(k))
    );

    const db = adminClient();
    const { data, error } = await db
        .from("customers")
        .update(patch)
        .eq("id", id)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
}
