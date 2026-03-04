import { NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import { requireCronAuth } from "@/lib/cron/auth";

export async function GET(req: Request) {
    const authError = requireCronAuth(req);
    if (authError) {
        return authError;
    }

    try {
        const db = adminClient();
        const { error } = await db.rpc("refresh_analytics_views");
        if (error) {
            console.error("Analytics refresh cron failed:", error);
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("Analytics refresh cron crashed:", e);
        return NextResponse.json(
            { success: false, error: e?.message ?? String(e) },
            { status: 500 }
        );
    }
}
