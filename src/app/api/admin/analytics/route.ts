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
    latest_synced_at: string | null;
};

type PixelDailyAggregate = {
    view_content: number;
    initiate_checkout: number;
    purchase: number;
    latest_day: string | null;
    latest_synced_at: string | null;
};

type QualityGaps = {
    snapshot_date: string;
    paid_missing_fbclid: number;
    paid_missing_fbp: number;
    paid_missing_page_url: number;
    paid_missing_client_ip: number;
    paid_missing_client_ua: number;
};

type QualitySeriesRow = {
    date: string;
    paid_orders: number;
    missing_fbclid: number;
    missing_fbp: number;
    missing_page_url: number;
    missing_client_ip: number;
    missing_client_ua: number;
};

type EngagementStats = {
    scroll_depth_50: number;
    initiate_checkout_aligned: number;
    scroll50_to_checkout_percent: number;
    aligned_from: string | null;
};

type AnalyticsFreshness = {
    local_view_content_last_at: string | null;
    local_scroll_depth_50_last_at: string | null;
    orders_created_last_at: string | null;
    orders_paid_last_at: string | null;
    capi_last_sent_at: string | null;
    meta_last_synced_at: string | null;
    pixel_daily_last_synced_at: string | null;
    quality_snapshot_date: string | null;
};

type DateRange = {
    from: string;
    to: string;
    fromTs: string;
    toExclusiveTs: string;
};

type FunnelDailyRow = {
    date: string;
    leads_count: number;
    unique_lead_phones: number;
    orders_created: number;
    orders_paid: number;
    total_revenue: number;
    conversion_rate_percent: string;
};

type PixelTotals = {
    view_content: number;
    initiate_checkout: number;
    purchase: number;
};

type PixelTotalsResult = {
    source: "pixel_stats" | "capi_fallback";
    totals: PixelTotals | null;
    reason?: string;
    preview?: unknown;
    requested_range?: { from: string; to: string };
};

const ADMIN_ANALYTICS_TZ = "Europe/Kyiv";

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

function isoDateFromParts(parts: { year: number; month: number; day: number }): string {
    const y = String(parts.year).padStart(4, "0");
    const m = String(parts.month).padStart(2, "0");
    const d = String(parts.day).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function getIsoDateInTimeZone(date: Date, timeZone: string): string {
    const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    const parts = dtf.formatToParts(date);
    const year = Number(parts.find((p) => p.type === "year")?.value ?? "0");
    const month = Number(parts.find((p) => p.type === "month")?.value ?? "0");
    const day = Number(parts.find((p) => p.type === "day")?.value ?? "0");
    return isoDateFromParts({ year, month, day });
}

function shiftIsoDate(isoDate: string, days: number): string {
    const [y, m, d] = isoDate.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
}

function parseShortOffsetToMs(raw: string): number | null {
    // Examples: "GMT+3", "GMT+03:00", "UTC-04:00"
    const m = raw.match(/([+-])(\d{1,2})(?::?(\d{2}))?$/);
    if (!m) return null;
    const sign = m[1] === "-" ? -1 : 1;
    const hh = Number(m[2] ?? "0");
    const mm = Number(m[3] ?? "0");
    return sign * (hh * 60 + mm) * 60 * 1000;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
    const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone,
        timeZoneName: "shortOffset",
        year: "numeric",
    });
    const tzName = dtf.formatToParts(date).find((p) => p.type === "timeZoneName")?.value ?? "";
    return parseShortOffsetToMs(tzName) ?? 0;
}

function localMidnightUtcIso(isoDate: string, timeZone: string): string {
    const [y, m, d] = isoDate.split("-").map(Number);
    let ts = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
    // Iterate to handle DST boundaries correctly.
    for (let i = 0; i < 3; i += 1) {
        const offsetMs = getTimeZoneOffsetMs(new Date(ts), timeZone);
        const next = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - offsetMs;
        if (next === ts) break;
        ts = next;
    }
    return new Date(ts).toISOString();
}

function formatDateIsoUtc(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function toFunnelDailyRow(raw: unknown): FunnelDailyRow | null {
    if (!raw || typeof raw !== "object") return null;
    const row = raw as Record<string, unknown>;
    const dateValue = row.date;
    const date =
        typeof dateValue === "string"
            ? dateValue.slice(0, 10)
            : dateValue instanceof Date
                ? formatDateIsoUtc(dateValue)
                : null;
    if (!date || !isIsoDate(date)) return null;
    return {
        date,
        leads_count: asFiniteNumber(row.leads_count),
        unique_lead_phones: asFiniteNumber(row.unique_lead_phones),
        orders_created: asFiniteNumber(row.orders_created),
        orders_paid: asFiniteNumber(row.orders_paid),
        total_revenue: asFiniteNumber(row.total_revenue),
        conversion_rate_percent:
            typeof row.conversion_rate_percent === "string"
                ? row.conversion_rate_percent
                : String(asFiniteNumber(row.conversion_rate_percent).toFixed(2)),
    };
}

function buildFunnelSeries(range: DateRange, rows: unknown[]): FunnelDailyRow[] {
    const byDate = new Map<string, FunnelDailyRow>();
    for (const raw of rows) {
        const row = toFunnelDailyRow(raw);
        if (!row) continue;
        byDate.set(row.date, row);
    }

    const from = new Date(`${range.from}T00:00:00.000Z`);
    const to = new Date(`${range.to}T00:00:00.000Z`);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to) {
        return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    }

    const result: FunnelDailyRow[] = [];
    for (let cursor = new Date(from); cursor <= to; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        const day = formatDateIsoUtc(cursor);
        const row = byDate.get(day);
        if (row) {
            result.push(row);
            continue;
        }
        result.push({
            date: day,
            leads_count: 0,
            unique_lead_phones: 0,
            orders_created: 0,
            orders_paid: 0,
            total_revenue: 0,
            conversion_rate_percent: "0.00",
        });
    }

    return result;
}

function normalizePixelEventName(raw: string): "view_content" | "initiate_checkout" | "purchase" | null {
    const value = raw.trim().toLowerCase();
    if (!value) return null;
    if (
        value === "viewcontent" ||
        value === "view_content" ||
        value.includes("fb_pixel_view_content") ||
        value.includes("view_content")
    ) {
        return "view_content";
    }
    if (
        value === "initiatecheckout" ||
        value === "initiate_checkout" ||
        value.includes("fb_pixel_initiate_checkout") ||
        value.includes("initiated_checkout") ||
        value.includes("initiate_checkout")
    ) {
        return "initiate_checkout";
    }
    if (value === "purchase" || value.includes("fb_pixel_purchase")) {
        return "purchase";
    }
    return null;
}

function parsePixelTotals(payload: unknown, range: DateRange): PixelTotals | null {
    const rows = Array.isArray((payload as { data?: unknown[] } | null)?.data)
        ? (payload as { data: unknown[] }).data
        : null;
    if (!rows || rows.length === 0) return null;

    const totals: PixelTotals = { view_content: 0, initiate_checkout: 0, purchase: 0 };

    for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        const r = row as Record<string, unknown>;
        const rowStart = typeof r.start_time === "string" ? Date.parse(r.start_time) : NaN;
        const rowEnd = typeof r.end_time === "string" ? Date.parse(r.end_time) : NaN;
        const rangeStart = Date.parse(range.fromTs);
        const rangeEnd = Date.parse(range.toExclusiveTs);
        const hasRowBounds = Number.isFinite(rowStart) || Number.isFinite(rowEnd);
        if (hasRowBounds) {
            const startTs = Number.isFinite(rowStart) ? rowStart : rangeStart;
            const endTs = Number.isFinite(rowEnd) ? rowEnd : startTs + 1;
            const overlaps = endTs > rangeStart && startTs < rangeEnd;
            if (!overlaps) continue;
        }

        // Shape A: flattened event rows
        const rawName =
            (typeof r.event === "string" && r.event) ||
            (typeof r.event_name === "string" && r.event_name) ||
            (typeof r.action_type === "string" && r.action_type) ||
            null;
        if (rawName) {
            const key = normalizePixelEventName(rawName);
            if (key) {
                const valueCandidates = [r.total_count, r.total, r.value, r.count];
                const value = valueCandidates
                    .map((candidate) => Number(candidate))
                    .find((n) => Number.isFinite(n) && n >= 0) ?? 0;
                totals[key] += value;
            }
        }

        // Shape B: bucket rows with nested data [{ value: "ViewContent", count: 1201 }, ...]
        const nested = Array.isArray(r.data) ? (r.data as unknown[]) : [];
        for (const item of nested) {
            if (!item || typeof item !== "object") continue;
            const entry = item as Record<string, unknown>;
            const eventName = typeof entry.value === "string" ? entry.value : null;
            if (!eventName) continue;
            const key = normalizePixelEventName(eventName);
            if (!key) continue;
            const count = Number(entry.count);
            if (!Number.isFinite(count) || count < 0) continue;
            totals[key] += count;
        }
    }

    if (totals.view_content === 0 && totals.initiate_checkout === 0 && totals.purchase === 0) {
        return null;
    }
    return totals;
}

async function fetchPixelTotals(range: DateRange): Promise<PixelTotalsResult> {
    const pixelId =
        process.env.META_PIXEL_ID ||
        process.env.META_AD_PIXEL_ID ||
        process.env.META_PIXEL;
    const token =
        process.env.META_ADS_ACCESS_TOKEN ||
        process.env.META_ACCESS_TOKEN ||
        process.env.META_CAPI_TOKEN;
    const apiVersion = process.env.META_GRAPH_API_VERSION || "v21.0";

    if (!pixelId || !token) {
        return {
            source: "capi_fallback",
            totals: null,
            reason: "missing_pixel_id_or_token",
            preview: null,
        };
    }

    const params = new URLSearchParams({
        access_token: token,
        start_time: range.from,
        end_time: range.to,
        aggregation: "event_total_counts",
    });

    const url = `https://graph.facebook.com/${apiVersion}/${pixelId}/stats?${params.toString()}`;
    const resp = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" } });
    const json = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
    const preview = {
        top_level_keys: Object.keys(json ?? {}),
        data_head: Array.isArray(json?.data) ? (json.data as unknown[]).slice(0, 3) : null,
    };
    if (!resp.ok) {
        const errorMessage =
            typeof json?.error === "object" && json.error && typeof (json.error as { message?: unknown }).message === "string"
                ? String((json.error as { message: string }).message)
                : `http_${resp.status}`;
        return {
            source: "capi_fallback",
            totals: null,
            reason: `pixel_stats_api_error:${errorMessage}`,
            preview,
            requested_range: { from: range.from, to: range.to },
        };
    }
    const totals = parsePixelTotals(json, range);
    if (!totals) {
        return {
            source: "capi_fallback",
            totals: null,
            reason: "pixel_stats_empty",
            preview,
            requested_range: { from: range.from, to: range.to },
        };
    }
    return {
        source: "pixel_stats",
        totals,
        preview,
        requested_range: { from: range.from, to: range.to },
    };
}

function toDateRange(searchParams: URLSearchParams): DateRange {
    const todayIso = getIsoDateInTimeZone(new Date(), ADMIN_ANALYTICS_TZ);
    const defaultTo = todayIso;
    const defaultFrom = shiftIsoDate(todayIso, -29);

    const rawFrom = searchParams.get("from");
    const rawTo = searchParams.get("to");

    const from = rawFrom && isIsoDate(rawFrom) ? rawFrom : defaultFrom;
    const to = rawTo && isIsoDate(rawTo) ? rawTo : defaultTo;
    const normalizedFrom = from <= to ? from : to;
    const normalizedTo = to >= from ? to : from;
    const clampedTo = normalizedTo > todayIso ? todayIso : normalizedTo;
    const clampedFrom = normalizedFrom > clampedTo ? clampedTo : normalizedFrom;

    const fromTs = localMidnightUtcIso(clampedFrom, ADMIN_ANALYTICS_TZ);
    const toExclusiveTs = localMidnightUtcIso(shiftIsoDate(clampedTo, 1), ADMIN_ANALYTICS_TZ);

    return {
        from: clampedFrom,
        to: clampedTo,
        fromTs,
        toExclusiveTs,
    };
}

async function getCapiEventStats(
    db: ReturnType<typeof adminClient>,
    eventName: CapiEventName,
    range: DateRange
): Promise<CapiEventStats> {
    const { data: rows, error } = await db
        .from("jobs")
        .select("status, created_at, payload")
        .eq("type", "meta:capi")
        .contains("payload", { event_name: eventName })
        .gte("created_at", range.fromTs)
        .lt("created_at", range.toExclusiveTs)
        .limit(100000);

    if (error) {
        throw new Error(error.message ?? "failed_to_read_capi_event_stats");
    }

    type CapiDedup = {
        hasSuccess: boolean;
        hasPending: boolean;
        hasRunning: boolean;
        hasFailed: boolean;
    };

    const dedup = new Map<string, CapiDedup>();
    let lastSeenAt: string | null = null;
    let legacyCounter = 0;

    for (const row of rows ?? []) {
        const createdAt = typeof row.created_at === "string" ? row.created_at : null;
        if (createdAt && (!lastSeenAt || createdAt > lastSeenAt)) {
            lastSeenAt = createdAt;
        }

        const payload = row.payload as Record<string, unknown> | null;
        const eventId = typeof payload?.event_id === "string" ? payload.event_id : null;
        const orderRef = typeof payload?.order_ref === "string" ? payload.order_ref : null;
        const dedupKey =
            eventId ||
            (orderRef ? `${eventName}:${orderRef}` : null) ||
            `legacy:${eventName}:${createdAt ?? "na"}:${legacyCounter++}`;

        const current = dedup.get(dedupKey) ?? {
            hasSuccess: false,
            hasPending: false,
            hasRunning: false,
            hasFailed: false,
        };
        if (row.status === "success") current.hasSuccess = true;
        else if (row.status === "pending") current.hasPending = true;
        else if (row.status === "running") current.hasRunning = true;
        else if (row.status === "failed") current.hasFailed = true;
        dedup.set(dedupKey, current);
    }

    let success = 0;
    let pending = 0;
    let running = 0;
    let failed = 0;

    for (const item of dedup.values()) {
        if (item.hasSuccess) success += 1;
        else if (item.hasPending) pending += 1;
        else if (item.hasRunning) running += 1;
        else if (item.hasFailed) failed += 1;
        else failed += 1;
    }

    return {
        event_name: eventName,
        total: dedup.size,
        success,
        pending,
        running,
        failed,
        last_seen_at: lastSeenAt,
    };
}

export async function GET(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

    const db = adminClient();
    const range = toDateRange(req.nextUrl.searchParams);

    // 1. Fetch Funnel
    const { data: funnelDataRaw, error: funnelErr } = await db
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
    let funnelData = buildFunnelSeries(range, funnelDataRaw ?? []);

    // 2. Fetch Revenue source breakdown in the selected period
    const { data: revenueOrders, error: revErr } = await db
        .from("orders")
        .select("campaign, status, amount, created_at")
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
    const ordersCreatedByDay = new Map<string, number>();
    const ordersPaidByDay = new Map<string, number>();
    const revenueByDay = new Map<string, number>();
    let paidRevenueFact = 0;
    for (const row of revenueOrders ?? []) {
        const createdAt = typeof row.created_at === "string" ? row.created_at : null;
        const dayKey = createdAt ? getIsoDateInTimeZone(new Date(createdAt), ADMIN_ANALYTICS_TZ) : null;
        const source = typeof row.campaign === "string" && row.campaign.trim() ? row.campaign.trim() : "organic";
        const existing = revenueMap.get(source) ?? {
            source_campaign: source,
            total_orders: 0,
            paid_orders: 0,
            total_revenue: 0,
        };
        existing.total_orders += 1;
        if (dayKey) {
            ordersCreatedByDay.set(dayKey, (ordersCreatedByDay.get(dayKey) ?? 0) + 1);
        }
        if (row.status === "paid" || row.status === "completed") {
            existing.paid_orders += 1;
            const paidAmount = asFiniteNumber(row.amount);
            existing.total_revenue += paidAmount;
            paidRevenueFact += paidAmount;
            if (dayKey) {
                ordersPaidByDay.set(dayKey, (ordersPaidByDay.get(dayKey) ?? 0) + 1);
                revenueByDay.set(dayKey, (revenueByDay.get(dayKey) ?? 0) + paidAmount);
            }
        }
        revenueMap.set(source, existing);
    }
    const revenueData = Array.from(revenueMap.values())
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, 20);

    // Align daily chart values with Kyiv-local order time (same basis as orders list).
    funnelData = funnelData.map((row) => ({
        ...row,
        orders_created: ordersCreatedByDay.get(row.date) ?? 0,
        orders_paid: ordersPaidByDay.get(row.date) ?? 0,
        total_revenue: revenueByDay.get(row.date) ?? 0,
    }));

    // 3. Overall stats from funnel
    const totalLeads = funnelData.reduce((acc, row) => acc + (row.leads_count || 0), 0);

    // 4. Meta daily aggregates (preferred source for ad-side metrics/events)
    const { data: metaRows, error: metaErr } = await db
        .from("analytics_meta_daily")
        .select("day, reach, impressions, clicks, spend, view_content, initiate_checkout, purchase, currency, synced_at")
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
            if (typeof row.synced_at === "string" && row.synced_at.trim()) {
                if (!acc.latest_synced_at || row.synced_at > acc.latest_synced_at) {
                    acc.latest_synced_at = row.synced_at;
                }
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
            latest_synced_at: null,
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

    const { data: pixelRows, error: pixelDailyErr } = await db
        .from("analytics_pixel_daily")
        .select("day, view_content, initiate_checkout, purchase, synced_at")
        .gte("day", range.from)
        .lte("day", range.to)
        .order("day", { ascending: false })
        .limit(366);
    if (pixelDailyErr) {
        console.warn("Analytics Pixel daily warning:", pixelDailyErr.message);
    }

    const pixelDailyAggregate: PixelDailyAggregate = (pixelRows ?? []).reduce<PixelDailyAggregate>(
        (acc, row) => {
            const day = typeof row.day === "string" ? row.day : null;
            if (!acc.latest_day && day) acc.latest_day = day;
            acc.view_content += asFiniteNumber(row.view_content);
            acc.initiate_checkout += asFiniteNumber(row.initiate_checkout);
            acc.purchase += asFiniteNumber(row.purchase);
            if (typeof row.synced_at === "string" && row.synced_at.trim()) {
                if (!acc.latest_synced_at || row.synced_at > acc.latest_synced_at) {
                    acc.latest_synced_at = row.synced_at;
                }
            }
            return acc;
        },
        {
            view_content: 0,
            initiate_checkout: 0,
            purchase: 0,
            latest_day: null,
            latest_synced_at: null,
        }
    );
    const pixelDailyDaysPresent = (pixelRows ?? []).length;
    const periodFromTs = Date.parse(`${range.from}T00:00:00.000Z`);
    const periodToTs = Date.parse(`${range.to}T00:00:00.000Z`);
    const pixelDailyExpectedDays =
        Number.isFinite(periodFromTs) && Number.isFinite(periodToTs) && periodToTs >= periodFromTs
            ? Math.floor((periodToTs - periodFromTs) / (24 * 60 * 60 * 1000)) + 1
            : 0;
    const pixelDailyCoveragePercent = pixelDailyExpectedDays > 0
        ? Number(((pixelDailyDaysPresent * 100) / pixelDailyExpectedDays).toFixed(2))
        : 0;

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
        const manualUpdatedAt =
            typeof marketingData.updated_at === "string" ? marketingData.updated_at : null;
        const manualUpdatedTs = manualUpdatedAt ? Date.parse(manualUpdatedAt) : NaN;
        const rangeStartTs = Date.parse(range.fromTs);
        const rangeEndTs = Date.parse(range.toExclusiveTs);
        const manualOverlapsSelectedPeriod =
            Number.isFinite(manualUpdatedTs) &&
            Number.isFinite(rangeStartTs) &&
            Number.isFinite(rangeEndTs) &&
            manualUpdatedTs >= rangeStartTs &&
            manualUpdatedTs < rangeEndTs;
        marketingInputs = {
            reach: manualOverlapsSelectedPeriod ? asFiniteNumber(marketingData.reach) : 0,
            impressions: manualOverlapsSelectedPeriod ? asFiniteNumber(marketingData.impressions) : 0,
            clicks: manualOverlapsSelectedPeriod ? asFiniteNumber(marketingData.clicks) : 0,
            spend: manualOverlapsSelectedPeriod ? asFiniteNumber(marketingData.spend) : 0,
            currency: typeof marketingData.currency === "string" ? marketingData.currency : "UAH",
            period_label: manualOverlapsSelectedPeriod && typeof marketingData.period_label === "string"
                ? marketingData.period_label
                : null,
            updated_at: manualOverlapsSelectedPeriod ? manualUpdatedAt : null,
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
            updated_at: metaAggregate.latest_synced_at || marketingInputs.updated_at,
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

    const { count: ordersCreatedCount, error: ordersCreatedErr } = await db
        .from("orders")
        .select("id", { count: "exact", head: true })
        .gte("created_at", range.fromTs)
        .lt("created_at", range.toExclusiveTs);
    if (ordersCreatedErr) {
        console.error("Analytics orders created count error:", ordersCreatedErr);
        return serverErrorResponse(ordersCreatedErr.message);
    }

    const { count: scrollDepth50Count, error: scrollErr } = await db
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("type", "scroll_depth_50")
        .gte("created_at", range.fromTs)
        .lt("created_at", range.toExclusiveTs);
    if (scrollErr) {
        console.error("Analytics scroll depth count error:", scrollErr);
        return serverErrorResponse(scrollErr.message);
    }

    const { data: firstScrollDepthRow, error: firstScrollErr } = await db
        .from("events")
        .select("created_at")
        .eq("type", "scroll_depth_50")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
    if (firstScrollErr) {
        console.warn("Analytics first scroll depth warning:", firstScrollErr.message);
    }
    const firstScrollDepthAt = (firstScrollDepthRow as { created_at?: string } | null)?.created_at ?? null;
    const alignedFromTs =
        firstScrollDepthAt && firstScrollDepthAt > range.fromTs ? firstScrollDepthAt : range.fromTs;

    const { count: alignedInitiateCheckoutCount, error: alignedInitiateErr } = await db
        .from("orders")
        .select("id", { count: "exact", head: true })
        .gte("created_at", alignedFromTs)
        .lt("created_at", range.toExclusiveTs);
    if (alignedInitiateErr) {
        console.error("Analytics aligned initiate checkout count error:", alignedInitiateErr);
        return serverErrorResponse(alignedInitiateErr.message);
    }

    const scrollDepth50Total = scrollDepth50Count ?? 0;
    const alignedInitiateCheckoutTotal = alignedInitiateCheckoutCount ?? 0;
    const engagement: EngagementStats = {
        scroll_depth_50: scrollDepth50Total,
        initiate_checkout_aligned: alignedInitiateCheckoutTotal,
        scroll50_to_checkout_percent: Number(
            safeDivide(alignedInitiateCheckoutTotal * 100, scrollDepth50Total).toFixed(2)
        ),
        aligned_from: alignedFromTs,
    };

    const { count: localViewContentCount, error: localViewErr } = await db
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("type", "view_content")
        .gte("created_at", range.fromTs)
        .lt("created_at", range.toExclusiveTs);
    if (localViewErr) {
        console.error("Analytics local view content count error:", localViewErr);
        return serverErrorResponse(localViewErr.message);
    }

    const pixelResult: PixelTotalsResult = await fetchPixelTotals(range).catch((err: unknown): PixelTotalsResult => {
        console.warn("Analytics Pixel stats warning:", err instanceof Error ? err.message : String(err));
        return {
            source: "capi_fallback" as const,
            totals: null,
            reason: "pixel_stats_unhandled_error",
            preview: null,
            requested_range: { from: range.from, to: range.to },
        };
    });

    const localViewContent = localViewContentCount ?? 0;
    const localViewContentFloored =
        localViewContent > 0 ? Math.max(localViewContent, ordersCreatedCount ?? 0) : localViewContent;
    const fallbackViewContent = pixelResult.totals?.view_content ?? viewContentStats.total;
    const hasPixelDailyViewContent = pixelDailyAggregate.view_content > 0;
    const referencePixelViewContent = pixelResult.totals?.view_content ?? null;
    const businessInitiateCheckout = ordersCreatedCount ?? 0;
    const pixelStatsUnavailable = (pixelResult.reason ?? "").startsWith("pixel_stats_api_error");
    const pixelDailyImplausibleForFunnel =
        hasPixelDailyViewContent &&
        businessInitiateCheckout > 0 &&
        pixelDailyAggregate.view_content < businessInitiateCheckout;
    const preferReferencePixelViewContent =
        referencePixelViewContent !== null &&
        referencePixelViewContent > 0 &&
        (
            !hasPixelDailyViewContent ||
            pixelDailyCoveragePercent < 80 ||
            pixelDailyAggregate.view_content < Math.round(referencePixelViewContent * 0.7)
        );
    const pixelDailyLowCoverageWhenPixelUnavailable =
        pixelStatsUnavailable &&
        hasPixelDailyViewContent &&
        pixelDailyCoveragePercent < 99;
    const usePixelDailyForViewContent =
        hasPixelDailyViewContent &&
        !preferReferencePixelViewContent &&
        !pixelDailyImplausibleForFunnel &&
        !pixelDailyLowCoverageWhenPixelUnavailable;
    const resolvedViewContent = usePixelDailyForViewContent
        ? pixelDailyAggregate.view_content
        : localViewContent > 0
            ? localViewContentFloored
            : fallbackViewContent;
    const viewContentSource =
        preferReferencePixelViewContent
            ? "pixel_stats_reference"
            : usePixelDailyForViewContent
            ? "pixel_daily_stats"
            : localViewContent > 0
            ? localViewContentFloored > localViewContent
                ? "local_events_floored"
                : "local_events"
            : pixelResult.totals?.view_content !== null
                ? "pixel_fallback"
                : "capi_fallback";

    const businessTotals: BusinessEventTotals = {
        // Preferred source is Pixel daily stats synced from Event Manager.
        view_content: resolvedViewContent,
        // InitiateCheckout business fact: checkout records created in DB.
        initiate_checkout: ordersCreatedCount ?? 0,
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

    const { data: qualityOrdersRows, error: qualitySeriesErr } = await db
        .from("orders")
        .select("created_at, status, fbclid, fbp, page_url, client_ip, client_ua")
        .gte("created_at", range.fromTs)
        .lt("created_at", range.toExclusiveTs)
        .in("status", ["paid", "completed"])
        .limit(50000);
    if (qualitySeriesErr) {
        console.warn("Analytics quality series warning:", qualitySeriesErr.message);
    }

    const qualitySeriesMap = new Map<string, QualitySeriesRow>();
    for (const row of qualityOrdersRows ?? []) {
        const createdAt = typeof row.created_at === "string" ? row.created_at : null;
        if (!createdAt) continue;
        const day = createdAt.slice(0, 10);
        const existing = qualitySeriesMap.get(day) ?? {
            date: day,
            paid_orders: 0,
            missing_fbclid: 0,
            missing_fbp: 0,
            missing_page_url: 0,
            missing_client_ip: 0,
            missing_client_ua: 0,
        };
        existing.paid_orders += 1;
        if (!row.fbclid) existing.missing_fbclid += 1;
        if (!row.fbp) existing.missing_fbp += 1;
        if (!row.page_url) existing.missing_page_url += 1;
        if (!row.client_ip) existing.missing_client_ip += 1;
        if (!row.client_ua) existing.missing_client_ua += 1;
        qualitySeriesMap.set(day, existing);
    }
    const quality_series = Array.from(qualitySeriesMap.values()).sort((a, b) =>
        a.date.localeCompare(b.date)
    );

    const [
        localViewFreshnessRes,
        scrollFreshnessRes,
        ordersCreatedFreshnessRes,
        ordersPaidFreshnessRes,
        capiFreshnessRes,
    ] = await Promise.all([
        db
            .from("events")
            .select("created_at")
            .eq("type", "view_content")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        db
            .from("events")
            .select("created_at")
            .eq("type", "scroll_depth_50")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        db
            .from("orders")
            .select("created_at")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        db
            .from("orders")
            .select("created_at")
            .in("status", ["paid", "completed"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        db
            .from("jobs")
            .select("created_at")
            .eq("type", "meta:capi")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
    ]);

    const freshnessErrors = [
        localViewFreshnessRes.error,
        scrollFreshnessRes.error,
        ordersCreatedFreshnessRes.error,
        ordersPaidFreshnessRes.error,
        capiFreshnessRes.error,
    ].filter(Boolean);
    if (freshnessErrors.length > 0) {
        console.warn("Analytics freshness warning:", freshnessErrors[0]?.message);
    }

    const freshness: AnalyticsFreshness = {
        local_view_content_last_at: (localViewFreshnessRes.data as { created_at?: string } | null)?.created_at ?? null,
        local_scroll_depth_50_last_at: (scrollFreshnessRes.data as { created_at?: string } | null)?.created_at ?? null,
        orders_created_last_at: (ordersCreatedFreshnessRes.data as { created_at?: string } | null)?.created_at ?? null,
        orders_paid_last_at: (ordersPaidFreshnessRes.data as { created_at?: string } | null)?.created_at ?? null,
        capi_last_sent_at: (capiFreshnessRes.data as { created_at?: string } | null)?.created_at ?? null,
        meta_last_synced_at: marketingInputs.updated_at ?? null,
        pixel_daily_last_synced_at: pixelDailyAggregate.latest_synced_at ?? null,
        quality_snapshot_date: qualityRow?.snapshot_date ?? null,
    };

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
        funnel_sources: {
            view_content: viewContentSource,
            initiate_checkout: "orders_created",
            purchase: "paid_orders",
            access_granted: "token_consumed",
        },
        engagement,
        marketing_inputs: marketingInputs,
        funnel_debug: {
            requested_period: {
                from: range.from,
                to: range.to,
            },
            view_content_source: viewContentSource,
            business_view_content: localViewContent,
            business_view_content_floored: localViewContentFloored,
            pixel_daily_view_content: pixelDailyAggregate.view_content,
            pixel_daily_days_present: pixelDailyDaysPresent,
            pixel_daily_expected_days: pixelDailyExpectedDays,
            pixel_daily_coverage_percent: pixelDailyCoveragePercent,
            pixel_daily_implausible_for_funnel: pixelDailyImplausibleForFunnel,
            pixel_daily_low_coverage_when_pixel_unavailable: pixelDailyLowCoverageWhenPixelUnavailable,
            prefer_reference_pixel_view_content: preferReferencePixelViewContent,
            resolved_view_content: resolvedViewContent,
            pixel_reason: pixelResult.reason ?? null,
            reference_pixel_view_content: pixelResult.totals?.view_content ?? null,
            transport_capi_view_content: viewContentStats.total,
            reference_pixel_initiate_checkout: pixelResult.totals?.initiate_checkout ?? null,
            business_initiate_checkout: ordersCreatedCount ?? 0,
            transport_capi_initiate_checkout: initiateCheckoutStats.total,
            pixel_preview: pixelResult.preview ?? null,
            pixel_requested_range: pixelResult.requested_range ?? null,
        },
        quality_gaps: (qualityRow ?? null) as QualityGaps | null,
        quality_series,
        freshness,
        kpis: {
            cpa: toFixed2(cpa),
            cpc: toFixed2(cpc),
            ctr_percent: toFixed2(ctrPercent),
            roas: toFixed2(roas),
            roi_percent: toFixed2(roiPercent),
        },
    });
}
