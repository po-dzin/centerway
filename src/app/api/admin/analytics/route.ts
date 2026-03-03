import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export async function GET(req: NextRequest) {
    const session = await requireAdmin(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = adminClient();

    // 1. Fetch Funnel
    const { data: funnelData, error: funnelErr } = await db
        .from("mv_funnel_daily")
        .select("*")
        .order("date", { ascending: true })
        .limit(30);

    if (funnelErr) {
        console.error("Analytics Funnel error:", funnelErr);
        return NextResponse.json({ error: funnelErr.message }, { status: 500 });
    }

    // 2. Fetch Revenue source breakdown
    const { data: revenueData, error: revErr } = await db
        .from("mv_revenue_by_campaign")
        .select("*")
        .order("total_revenue", { ascending: false })
        .limit(20);

    if (revErr) {
        console.error("Analytics Revenue error:", revErr);
        return NextResponse.json({ error: revErr.message }, { status: 500 });
    }

    // 3. Overall stats
    const totalLeads = funnelData.reduce((acc, row) => acc + (row.leads_count || 0), 0);
    const totalPaidOrders = funnelData.reduce((acc, row) => acc + (row.orders_paid || 0), 0);
    const totalRevenue = funnelData.reduce((acc, row) => acc + (row.total_revenue || 0), 0);

    return NextResponse.json({
        funnel: funnelData,
        campaigns: revenueData,
        summary: {
            totalLeads,
            totalPaidOrders,
            totalRevenue,
            avgConversionRate: totalLeads > 0 ? ((totalPaidOrders / totalLeads) * 100).toFixed(2) : 0
        }
    });
}
