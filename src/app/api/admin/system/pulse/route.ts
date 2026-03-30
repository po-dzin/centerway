import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import { processPendingJobs } from "@/lib/jobs/worker";
import { syncMetaAdsInsights } from "@/lib/tracking/metaAdsSync";
import type { CapiEventPayload } from "@/lib/tracking/capi";
import { requireAdminSession, serverErrorResponse, unauthorizedResponse } from "@/lib/api/adminRoute";

async function backfillInitiateCheckoutJobs(daysBack = 2): Promise<number> {
    const db = adminClient();
    const fromDate = new Date();
    fromDate.setUTCDate(fromDate.getUTCDate() - Math.max(1, daysBack));
    const fromIso = fromDate.toISOString();

    const { data: orders, error: ordersErr } = await db
        .from("orders")
        .select("order_ref, product_code, amount, currency, created_at, fbp, fbclid, client_ip, client_ua, page_url")
        .gte("created_at", fromIso)
        .limit(5000);
    if (ordersErr) {
        throw new Error(`orders_backfill_read_failed:${ordersErr.message}`);
    }
    if (!orders?.length) return 0;

    const { data: jobs, error: jobsErr } = await db
        .from("jobs")
        .select("payload, created_at")
        .eq("type", "meta:capi")
        .gte("created_at", fromIso)
        .contains("payload", { event_name: "InitiateCheckout" })
        .limit(10000);
    if (jobsErr) {
        throw new Error(`jobs_backfill_read_failed:${jobsErr.message}`);
    }

    const existingByOrderRef = new Set<string>();
    for (const row of jobs ?? []) {
        const payload = (row as { payload?: Record<string, unknown> }).payload;
        const orderRef = typeof payload?.order_ref === "string" ? payload.order_ref : null;
        if (orderRef) existingByOrderRef.add(orderRef);
    }

    const toInsert = [];
    for (const order of orders) {
        const orderRef = typeof order.order_ref === "string" ? order.order_ref : null;
        if (!orderRef) continue;
        if (existingByOrderRef.has(orderRef)) continue;

        const eventTimeTs = typeof order.created_at === "string"
            ? Math.floor(Date.parse(order.created_at) / 1000)
            : Math.floor(Date.now() / 1000);
        const payload: CapiEventPayload = {
            event_name: "InitiateCheckout",
            event_id: `checkout_${orderRef}`,
            event_time: Number.isFinite(eventTimeTs) ? eventTimeTs : Math.floor(Date.now() / 1000),
            value: typeof order.amount === "number" ? order.amount : Number(order.amount) || undefined,
            currency: typeof order.currency === "string" ? order.currency : undefined,
            order_ref: orderRef,
            fbp: typeof order.fbp === "string" ? order.fbp : null,
            fbclid: typeof order.fbclid === "string" ? order.fbclid : null,
            ip_address: typeof order.client_ip === "string" ? order.client_ip : null,
            user_agent: typeof order.client_ua === "string" ? order.client_ua : null,
            event_source_url: typeof order.page_url === "string" ? order.page_url : null,
            action_source: "website",
            content_name: typeof order.product_code === "string" ? order.product_code : undefined,
            content_type: "product",
            content_ids: typeof order.product_code === "string" ? [order.product_code] : undefined,
        };

        toInsert.push({
            type: "meta:capi",
            payload,
            status: "pending",
        });
    }

    if (!toInsert.length) return 0;
    const { error: insertErr } = await db.from("jobs").insert(toInsert);
    if (insertErr) {
        throw new Error(`jobs_backfill_insert_failed:${insertErr.message}`);
    }
    return toInsert.length;
}

export async function POST(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

    try {
        const { searchParams } = new URL(req.url);
        const refreshAnalytics = searchParams.get("refreshAnalytics") === "1";
        const refreshMeta = searchParams.get("refreshMeta") === "1";

        const processedCount = await processPendingJobs(20);
        let backfilledInitiateCheckout = 0;
        try {
            backfilledInitiateCheckout = await backfillInitiateCheckoutJobs(2);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.warn("Admin pulse: initiate checkout backfill failed", message);
        }

        let analyticsRefreshed = false;
        if (refreshAnalytics) {
            const db = adminClient();
            const { error } = await db.rpc("refresh_analytics_views");
            if (error) {
                console.error("Admin pulse: analytics refresh failed", error);
            } else {
                analyticsRefreshed = true;
            }
        }

        let metaSyncTriggered = false;
        let metaSyncError: string | null = null;
        if (refreshMeta) {
            const db = adminClient();
            const { data: lastMetaSync } = await db
                .from("analytics_meta_daily")
                .select("synced_at")
                .order("synced_at", { ascending: false })
                .limit(1)
                .maybeSingle();
            const latestTs = typeof lastMetaSync?.synced_at === "string"
                ? Date.parse(lastMetaSync.synced_at)
                : NaN;
            const staleMs = 24 * 60 * 60 * 1000;
            const isStaleOrEmpty = !Number.isFinite(latestTs) || Date.now() - latestTs >= staleMs;

            if (isStaleOrEmpty) {
                try {
                    await syncMetaAdsInsights();
                    metaSyncTriggered = true;
                } catch (e: unknown) {
                    metaSyncError = e instanceof Error ? e.message : String(e);
                    console.warn("Admin pulse: meta sync skipped/failed", metaSyncError);
                }
            }
        }

        return NextResponse.json({
            success: true,
            processedCount,
            backfilledInitiateCheckout,
            analyticsRefreshed,
            metaSyncTriggered,
            metaSyncError,
            actor: session.user.id,
        });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return serverErrorResponse(message);
    }
}
