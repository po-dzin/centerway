import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import { requireAdminSession, serverErrorResponse, unauthorizedResponse } from "@/lib/api/adminRoute";

type CapiEventName = "ViewContent" | "InitiateCheckout" | "Purchase";

type CapiEventStats = {
    event_name: CapiEventName;
    total: number;
    success: number;
    pending: number;
    running: number;
    failed: number;
    last_seen_at: string | null;
};

type MarketingInputs = {
    reach: number;
    impressions: number;
    clicks: number;
    spend: number;
    currency: string;
    period_label: string | null;
    updated_at: string | null;
    source?: "meta" | "manual";
};

type BusinessEventTotals = {
    view_content: number;
    initiate_checkout: number;
    purchase: number;
    access_granted: number;
};

type MetaAggregate = {
    reach: number;
    impressions: number;
    clicks: number;
    spend: number;
    view_content: number;
    initiate_checkout: number;
    purchase: number;
    currency: string;
    latest_day: string | null;
};

type QualityGaps = {
    snapshot_date: string;
    paid_missing_fbclid: number;
    paid_missing_fbp: number;
    paid_missing_page_url: number;
    paid_missing_client_ip: number;
    paid_missing_client_ua: number;
};

type DateRange = {
    from: string;
    to: string;
    fromTs: string;
    toExclusiveTs: string;
};

function asFiniteNumber(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function safeDivide(numerator: number, denominator: number): number {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
    return numerator / denominator;
}

function isIsoDate(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toDateRange(searchParams: URLSearchParams): DateRange {
    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const defaultTo = todayIso;
    const defaultFromDate = new Date(today);
    defaultFromDate.setDate(defaultFromDate.getDate() - 29);
    const defaultFrom = defaultFromDate.toISOString().slice(0, 10);

    const rawFrom = searchParams.get("from");
    const rawTo = searchParams.get("to");

    const from = rawFrom && isIsoDate(rawFrom) ? rawFrom : defaultFrom;
    const to = rawTo && isIsoDate(rawTo) ? rawTo : defaultTo;
    const normalizedFrom = from <= to ? from : to;
    const normalizedTo = to >= from ? to : from;
    const clampedTo = normalizedTo > todayIso ? todayIso : normalizedTo;
    const clampedFrom = normalizedFrom > clampedTo ? clampedTo : normalizedFrom;

    const toDate = new Date(`${clampedTo}T00:00:00.000Z`);
    toDate.setUTCDate(toDate.getUTCDate() + 1);

    return {
        from: clampedFrom,
        to: clampedTo,
        fromTs: `${clampedFrom}T00:00:00.000Z`,
        toExclusiveTs: toDate.toISOString(),
    };
}

async function getCapiEventStats(
    db: ReturnType<typeof adminClient>,
    eventName: CapiEventName,
    range: DateRange
): Promise<CapiEventStats> {
    const base = db
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("type", "meta:capi")
        .contains("payload", { event_name: eventName })
        .gte("created_at", range.fromTs)
        .lt("created_at", range.toExclusiveTs);

    const [totalRes, successRes, pendingRes, runningRes, failedRes, lastRes] = await Promise.all([
        base,
        db.from("jobs")
            .select("id", { count: "exact", head: true })
            .eq("type", "meta:capi")
            .contains("payload", { event_name: eventName })
            .gte("created_at", range.fromTs)
            .lt("created_at", range.toExclusiveTs)
            .eq("status", "success"),
        db.from("jobs")
            .select("id", { count: "exact", head: true })
            .eq("type", "meta:capi")
            .contains("payload", { event_name: eventName })
            .gte("created_at", range.fromTs)
            .lt("created_at", range.toExclusiveTs)
            .eq("status", "pending"),
        db.from("jobs")
            .select("id", { count: "exact", head: true })
            .eq("type", "meta:capi")
            .contains("payload", { event_name: eventName })
            .gte("created_at", range.fromTs)
            .lt("created_at", range.toExclusiveTs)
            .eq("status", "running"),
        db.from("jobs")
            .select("id", { count: "exact", head: true })
            .eq("type", "meta:capi")
            .contains("payload", { event_name: eventName })
            .gte("created_at", range.fromTs)
            .lt("created_at", range.toExclusiveTs)
            .eq("status", "failed"),
        db.from("jobs")
            .select("created_at")
            .eq("type", "meta:capi")
            .contains("payload", { event_name: eventName })
            .gte("created_at", range.fromTs)
            .lt("created_at", range.toExclusiveTs)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
    ]);

    const possibleErrors = [
        totalRes.error,
        successRes.error,
        pendingRes.error,
        runningRes.error,
        failedRes.error,
        lastRes.error,
    ].filter(Boolean);
    if (possibleErrors.length > 0) {
        throw new Error(possibleErrors[0]?.message ?? "failed_to_read_capi_event_stats");
    }

    return {
        event_name: eventName,
        total: totalRes.count ?? 0,
        success: successRes.count ?? 0,
        pending: pendingRes.count ?? 0,
        running: runningRes.count ?? 0,
        failed: failedRes.count ?? 0,
        last_seen_at: (lastRes.data as { created_at?: string } | null)?.created_at ?? null,
    };
}

export async function GET(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

    const db = adminClient();
    const range = toDateRange(req.nextUrl.searchParams);

    // 1. Fetch Funnel
    const { data: funnelData, error: funnelErr } = await db
        .from("mv_funnel_daily")
        .select("*")
        .gte("date", range.from)
        .lte("date", range.to)
        .order("date", { ascending: true })
        .limit(366);

    if (funnelErr) {
        console.error("Analytics Funnel error:", funnelErr);
        return serverErrorResponse(funnelErr.message);
    }

    // 2. Fetch Revenue source breakdown in the selected period
    const { data: revenueOrders, error: revErr } = await db
        .from("orders")
        .select("campaign, status, amount")
        .gte("created_at", range.fromTs)
        .lt("created_at", range.toExclusiveTs)
        .limit(50000);

    if (revErr) {
        console.error("Analytics Revenue error:", revErr);
        return serverErrorResponse(revErr.message);
    }
    const revenueMap = new Map<
        string,
        { source_campaign: string; total_orders: number; paid_orders: number; total_revenue: number }
    >();
    let paidRevenueFact = 0;
    for (const row of revenueOrders ?? []) {
        const source = typeof row.campaign === "string" && row.campaign.trim() ? row.campaign.trim() : "organic";
        const existing = revenueMap.get(source) ?? {
            source_campaign: source,
            total_orders: 0,
            paid_orders: 0,
            total_revenue: 0,
        };
        existing.total_orders += 1;
        if (row.status === "paid" || row.status === "completed") {
            existing.paid_orders += 1;
            const paidAmount = asFiniteNumber(row.amount);
            existing.total_revenue += paidAmount;
            paidRevenueFact += paidAmount;
        }
        revenueMap.set(source, existing);
    }
    const revenueData = Array.from(revenueMap.values())
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, 20);

    // 3. Overall stats from funnel
    const totalLeads = funnelData.reduce((acc, row) => acc + (row.leads_count || 0), 0);

    // 4. Meta daily aggregates (preferred source for ad-side metrics/events)
    const { data: metaRows, error: metaErr } = await db
        .from("analytics_meta_daily")
        .select("day, reach, impressions, clicks, spend, view_content, initiate_checkout, purchase, currency")
        .gte("day", range.from)
        .lte("day", range.to)
        .order("day", { ascending: false })
        .limit(366);
    if (metaErr) {
        console.warn("Analytics Meta aggregate warning:", metaErr.message);
    }

    const metaAggregate: MetaAggregate = (metaRows ?? []).reduce<MetaAggregate>(
        (acc, row) => {
            const day = typeof row.day === "string" ? row.day : null;
            if (!acc.latest_day && day) acc.latest_day = day;
            acc.reach += asFiniteNumber(row.reach);
            acc.impressions += asFiniteNumber(row.impressions);
            acc.clicks += asFiniteNumber(row.clicks);
            acc.spend += asFiniteNumber(row.spend);
            acc.view_content += asFiniteNumber(row.view_content);
            acc.initiate_checkout += asFiniteNumber(row.initiate_checkout);
            acc.purchase += asFiniteNumber(row.purchase);
            if (typeof row.currency === "string" && row.currency.trim()) {
                acc.currency = row.currency.trim();
            }
            return acc;
        },
        {
            reach: 0,
            impressions: 0,
            clicks: 0,
            spend: 0,
            view_content: 0,
            initiate_checkout: 0,
            purchase: 0,
            currency: "UAH",
            latest_day: null,
        }
    );

    const hasMetaAggregate =
        metaAggregate.reach > 0 ||
        metaAggregate.impressions > 0 ||
        metaAggregate.clicks > 0 ||
        metaAggregate.spend > 0 ||
        metaAggregate.view_content > 0 ||
        metaAggregate.initiate_checkout > 0 ||
        metaAggregate.purchase > 0;

    // 5. Manual marketing input row (fallback if Meta sync not available yet)
    let marketingInputs: MarketingInputs = {
        reach: 0,
        impressions: 0,
        clicks: 0,
        spend: 0,
        currency: "UAH",
        period_label: null,
        updated_at: null,
        source: "manual",
    };

    const { data: marketingData, error: marketingErr } = await db
        .from("analytics_marketing_inputs")
        .select("reach, impressions, clicks, spend, currency, period_label, updated_at")
        .eq("id", 1)
        .maybeSingle();

    if (marketingErr) {
        console.warn("Analytics Marketing Inputs warning:", marketingErr.message);
    } else if (marketingData) {
        marketingInputs = {
            reach: asFiniteNumber(marketingData.reach),
            impressions: asFiniteNumber(marketingData.impressions),
            clicks: asFiniteNumber(marketingData.clicks),
            spend: asFiniteNumber(marketingData.spend),
            currency: typeof marketingData.currency === "string" ? marketingData.currency : "UAH",
            period_label: typeof marketingData.period_label === "string" ? marketingData.period_label : null,
            updated_at: typeof marketingData.updated_at === "string" ? marketingData.updated_at : null,
            source: "manual",
        };
    }

    if (hasMetaAggregate) {
        marketingInputs = {
            reach: metaAggregate.reach,
            impressions: metaAggregate.impressions,
            clicks: metaAggregate.clicks,
            spend: metaAggregate.spend,
            currency: metaAggregate.currency || marketingInputs.currency,
            period_label: metaAggregate.latest_day ? `meta synced up to ${metaAggregate.latest_day}` : marketingInputs.period_label,
            updated_at: marketingInputs.updated_at,
            source: "meta",
        };
    }

    // 6. CAPI event-level stats
    const [viewContentStats, initiateCheckoutStats, purchaseStats] = await Promise.all([
        getCapiEventStats(db, "ViewContent", range),
        getCapiEventStats(db, "InitiateCheckout", range),
        getCapiEventStats(db, "Purchase", range),
    ]);

    // 7. Access granted proxy (token consumed)
    const { count: accessGrantedCount, error: accessErr } = await db
        .from("events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", range.fromTs)
        .lt("created_at", range.toExclusiveTs)
        .eq("type", "token_consumed");
    if (accessErr) {
        console.error("Analytics access count error:", accessErr);
        return serverErrorResponse(accessErr.message);
    }

    // 7.5 Business-fact event totals (not CAPI transport totals)
    const { count: paidOrdersCount, error: paidErr } = await db
        .from("orders")
        .select("id", { count: "exact", head: true })
        .gte("created_at", range.fromTs)
        .lt("created_at", range.toExclusiveTs)
        .in("status", ["paid", "completed"]);
    if (paidErr) {
        console.error("Analytics paid count error:", paidErr);
        return serverErrorResponse(paidErr.message);
    }

    const businessTotals: BusinessEventTotals = {
        // Use event stream totals (CAPI jobs) for top/mid funnel to avoid Ads-attribution skew.
        view_content: viewContentStats.total,
        initiate_checkout: initiateCheckoutStats.total,
        // Purchase remains business-fact from paid/completed orders.
        purchase: paidOrdersCount ?? 0,
        access_granted: accessGrantedCount ?? 0,
    };
    const totalPaidOrders = businessTotals.purchase;
    const totalRevenue = paidRevenueFact;

    const { data: qualityRow, error: qualityErr } = await db
        .from("mv_quality_gaps")
        .select("snapshot_date, paid_missing_fbclid, paid_missing_fbp, paid_missing_page_url, paid_missing_client_ip, paid_missing_client_ua")
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (qualityErr) {
        console.warn("Analytics quality gaps warning:", qualityErr.message);
    }

    // 8. Unified KPI formulas
    const spend = marketingInputs.spend;
    const clicks = marketingInputs.clicks;
    const impressions = marketingInputs.impressions;
    const cpa = safeDivide(spend, Math.max(totalPaidOrders, businessTotals.purchase));
    const cpc = safeDivide(spend, clicks);
    const ctrPercent = safeDivide(clicks * 100, impressions);
    const roas = safeDivide(totalRevenue, spend);
    const roiPercent = safeDivide((totalRevenue - spend) * 100, spend);

    const toFixed2 = (value: number) => Number(value.toFixed(2));

    return NextResponse.json({
        period: {
            from: range.from,
            to: range.to,
        },
        funnel: funnelData,
        campaigns: revenueData,
        summary: {
            totalLeads,
            totalPaidOrders,
            totalRevenue,
            avgConversionRate: totalLeads > 0 ? ((totalPaidOrders / totalLeads) * 100).toFixed(2) : 0
        },
        capi_events: [viewContentStats, initiateCheckoutStats, purchaseStats],
        capi_overview: {
            total: viewContentStats.total + initiateCheckoutStats.total + purchaseStats.total,
            success: viewContentStats.success + initiateCheckoutStats.success + purchaseStats.success,
            pending: viewContentStats.pending + initiateCheckoutStats.pending + purchaseStats.pending,
            running: viewContentStats.running + initiateCheckoutStats.running + purchaseStats.running,
            failed: viewContentStats.failed + initiateCheckoutStats.failed + purchaseStats.failed,
        },
        funnel_chain: {
            view_content: businessTotals.view_content,
            initiate_checkout: businessTotals.initiate_checkout,
            purchase: businessTotals.purchase,
            access_granted: businessTotals.access_granted,
            view_to_checkout_percent: toFixed2(
                safeDivide(businessTotals.initiate_checkout * 100, businessTotals.view_content)
            ),
            checkout_to_purchase_percent: toFixed2(
                safeDivide(businessTotals.purchase * 100, businessTotals.initiate_checkout)
            ),
            purchase_to_access_percent: toFixed2(
                safeDivide(businessTotals.access_granted * 100, businessTotals.purchase)
            ),
        },
        business_events: businessTotals,
        marketing_inputs: marketingInputs,
        quality_gaps: (qualityRow ?? null) as QualityGaps | null,
        kpis: {
            cpa: toFixed2(cpa),
            cpc: toFixed2(cpc),
            ctr_percent: toFixed2(ctrPercent),
            roas: toFixed2(roas),
            roi_percent: toFixed2(roiPercent),
        },
    });
}
