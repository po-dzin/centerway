import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const session = await requireAdmin(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const params = await context.params;

    const db = adminClient();

    // Reset status to pending to be picked up again
    const { data, error } = await db
        .from("jobs")
        .update({
            status: "pending",
            error_text: null,
            attempts: 0,
            run_at: new Date().toISOString()
        })
        .eq("id", params.id)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data });
}
