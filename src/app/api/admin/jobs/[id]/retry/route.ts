import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import { requireAdminSession, serverErrorResponse, unauthorizedResponse } from "@/lib/api/adminRoute";

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

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

    if (error) return serverErrorResponse(error.message);
    return NextResponse.json({ data: data });
}
