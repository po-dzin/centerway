import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { adminClient } from "@/lib/auth/adminClient";
import { requireAdminSession, serverErrorResponse, unauthorizedResponse } from "@/lib/api/adminRoute";
import { normalizeTrackingString, resolveFbc } from "@/lib/tracking/metaClickIds";

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
    paid_missing_fbc_raw: number;
    paid_recoverable_fbc_from_fbclid: number;
    paid_truly_missing_fbc: number;
    paid_missing_fbclid: number;
    paid_missing_fbp: number;
    paid_missing_page_url: number;
    paid_missing_client_ip: number;
    paid_missing_client_ua: number;
};

type QualitySeriesRow = {
    date: string;
    paid_orders: number;
    missing_fbc_raw: number;
    recoverable_fbc_from_fbclid: number;
    truly_missing_fbc: number;
    missing_fbclid: number;
    missing_fbp: number;
    missing_page_url: number;
    missing_client_ip: number;
    missing_client_ua: number;
};

type PurchaseTransportRow = {
    total_paid_orders: number;
    success: number;
    pending: number;
    running: number;
    failed: number;
    missing_job: number;
    stale_pending: number;
    client_signal: number;
    missing_client_signal: number;
    last_success_at: string | null;
};

type PaidWindowOrder = {
    order_ref: string;
    paid_at: string;
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

type CampaignBreakdownLevel = "adset" | "ad";

type CampaignBreakdownRow = {
    source_campaign: string;
    total_orders: number;
    paid_orders: number;
    total_revenue: number;
    view_content: number;
    impressions: number;
    reach: number;
    spend: number;
    currency: string;
};

type ProductBreakdownRow = {
    product_code: string;
    total_orders: number;
    paid_orders: number;
    total_revenue: number;
    share_revenue_percent: number;
};

type MetaBreakdownInputRow = {
    source_id: string;
    source_name: string;
    view_content: number;
    reach: number;
    impressions: number;
    spend: number;
    currency: string;
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

function payloadString(payload: unknown, key: string): string | null {
    if (!payload || typeof payload !== "object") return null;
    const value = (payload as Record<string, unknown>)[key];
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeCampaignSource(raw: unknown, fallback: string): string {
    if (typeof raw !== "string") return fallback;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : fallback;
}

function campaignMergeKey(sourceCampaign: string): string {
    return sourceCampaign.trim().toLowerCase();
}

function campaignLooseKey(sourceCampaign: string): string {
    return sourceCampaign
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "");
}

function isLikelyMetaId(value: string): boolean {
    return /^\d{8,}$/.test(value.trim());
}

function preferredSourceLabel(sourceName: string, sourceId: string, fallback: string): string {
    if (sourceName && !isLikelyMetaId(sourceName)) return sourceName;
    if (sourceId) return sourceId;
    return fallback;
}

function isTemplatePlaceholder(value: string): boolean {
    return /\{\{[^}]+\}\}/.test(value);
}

function campaignBreakdownLevelFromQuery(searchParams: URLSearchParams): CampaignBreakdownLevel {
    const raw = (searchParams.get("campaign_level") ?? "").trim().toLowerCase();
    return raw === "ad" ? "ad" : "adset";
}

function extractUrlQueryParam(rawUrl: unknown, param: string): string | null {
    if (typeof rawUrl !== "string" || !rawUrl.trim()) return null;
    const valueFromUrl = (url: URL): string | null => {
        const value = url.searchParams.get(param);
        return value && value.trim() ? value.trim() : null;
    };
    try {
        return valueFromUrl(new URL(rawUrl));
    } catch {
        try {
            return valueFromUrl(new URL(rawUrl, "https://centerway.local"));
        } catch {
            return null;
        }
    }
}

function resolveOrderBreakdownSource(
    level: CampaignBreakdownLevel,
    values: {
        campaignParam: string | null;
        contentParam: string | null;
        termParam: string | null;
        fallbackCampaign: unknown;
        knownMetaIds: Set<string>;
    }
): string {
    const campaignParam = normalizeCampaignSource(values.campaignParam ?? values.fallbackCampaign, "");
    const contentParam = normalizeCampaignSource(values.contentParam, "");
    const termParam = normalizeCampaignSource(values.termParam, "");
    const knownMetaIds = values.knownMetaIds;

    if (level === "adset") {
        // Preferred (new): utm_content={{adset.id}}.
        if (contentParam && isLikelyMetaId(contentParam) && knownMetaIds.has(contentParam)) return contentParam;
        // Legacy: utm_campaign={{adset.name}}.
        if (campaignParam && !isTemplatePlaceholder(campaignParam)) return campaignParam;
        // Additional backward compatibility if adset name is still in utm_content.
        if (contentParam && !isTemplatePlaceholder(contentParam) && !isLikelyMetaId(contentParam)) return contentParam;
        return "organic";
    }

    // level === "ad"
    // Preferred (new): utm_term={{ad.id}} (or ad.name)
    if (termParam && !isTemplatePlaceholder(termParam)) return termParam;
    // Legacy in current account: utm_content={{ad.name}}.
    if (contentParam && !isTemplatePlaceholder(contentParam)) {
        if (isLikelyMetaId(contentParam)) {
            return knownMetaIds.has(contentParam) ? contentParam : "organic";
        }
        return contentParam;
    }
    return "organic";
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

function toUnixSeconds(isoString: string | null): number | null {
    if (!isoString) return null;
    const ms = Date.parse(isoString);
    if (!Number.isFinite(ms)) return null;
    return Math.floor(ms / 1000);
}

function compareIsoDesc(a: string | null, b: string | null): number {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    return a < b ? 1 : a > b ? -1 : 0;
}

function buildPaidWindowOrders(
    payments: Array<{ order_ref?: unknown; status?: unknown; created_at?: unknown }>,
    paymentEvents: Array<{ order_ref?: unknown; created_at?: unknown }>
): PaidWindowOrder[] {
    const byOrderRef = new Map<string, PaidWindowOrder>();

    for (const row of payments) {
        const orderRef = normalizeTrackingString(row.order_ref);
        const createdAt = normalizeTrackingString(row.created_at);
        const status = normalizeTrackingString(row.status);
        if (!orderRef || !createdAt) continue;
        if (status !== "paid" && status !== "completed") continue;
        if (!byOrderRef.has(orderRef)) {
            byOrderRef.set(orderRef, { order_ref: orderRef, paid_at: createdAt });
        }
    }

    for (const row of paymentEvents) {
        const orderRef = normalizeTrackingString(row.order_ref);
        const createdAt = normalizeTrackingString(row.created_at);
        if (!orderRef || !createdAt) continue;
        if (!byOrderRef.has(orderRef)) {
            byOrderRef.set(orderRef, { order_ref: orderRef, paid_at: createdAt });
        }
    }

    return Array.from(byOrderRef.values()).sort((a, b) => compareIsoDesc(a.paid_at, b.paid_at));
}

async function fetchLatestPurchaseJobsByOrderRefs(
    db: ReturnType<typeof adminClient>,
    orderRefs: string[]
): Promise<Map<string, { status: string; created_at: string | null }>> {
    const result = new Map<string, { status: string; created_at: string | null }>();
    if (orderRefs.length === 0) return result;

    const chunkSize = 25;

    for (let i = 0; i < orderRefs.length; i += chunkSize) {
        const chunk = orderRefs.slice(i, i + chunkSize);
        const rows = await Promise.all(
            chunk.map(async (orderRef) => {
                const { data, error } = await db
                    .from("jobs")
                    .select("status, created_at")
                    .eq("type", "meta:capi")
                    .contains("payload", { event_name: "Purchase", order_ref: orderRef })
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (error) throw new Error(error.message);
                return { orderRef, row: data as { status?: string; created_at?: string | null } | null };
            })
        );

        for (const item of rows) {
            if (!item.row?.status) continue;
            result.set(item.orderRef, {
                status: item.row.status,
                created_at: item.row.created_at ?? null,
            });
        }
    }

    return result;
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

async function getCapiEventStatsMap(
    db: ReturnType<typeof adminClient>,
    range: DateRange
): Promise<Map<CapiEventName, CapiEventStats>> {
    const { data: rows, error } = await db
        .from("jobs")
        .select("status, created_at, payload")
        .eq("type", "meta:capi")
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

    const perEventDedup = new Map<CapiEventName, Map<string, CapiDedup>>([
        ["ViewContent", new Map()],
        ["InitiateCheckout", new Map()],
        ["Purchase", new Map()],
    ]);
    const perEventLastSeen = new Map<CapiEventName, string | null>([
        ["ViewContent", null],
        ["InitiateCheckout", null],
        ["Purchase", null],
    ]);
    const perEventLegacyCounters = new Map<CapiEventName, number>([
        ["ViewContent", 0],
        ["InitiateCheckout", 0],
        ["Purchase", 0],
    ]);

    for (const row of rows ?? []) {
        const payload = row.payload as Record<string, unknown> | null;
        const eventName = payload?.event_name;
        if (eventName !== "ViewContent" && eventName !== "InitiateCheckout" && eventName !== "Purchase") {
            continue;
        }
        const createdAt = typeof row.created_at === "string" ? row.created_at : null;
        const lastSeenAt = perEventLastSeen.get(eventName) ?? null;
        if (createdAt && (!lastSeenAt || createdAt > lastSeenAt)) {
            perEventLastSeen.set(eventName, createdAt);
        }
        const eventId = typeof payload?.event_id === "string" ? payload.event_id : null;
        const orderRef = typeof payload?.order_ref === "string" ? payload.order_ref : null;
        let legacyCounter = perEventLegacyCounters.get(eventName) ?? 0;
        const dedupKey =
            eventId ||
            (orderRef ? `${eventName}:${orderRef}` : null) ||
            `legacy:${eventName}:${createdAt ?? "na"}:${legacyCounter++}`;
        perEventLegacyCounters.set(eventName, legacyCounter);

        const dedup = perEventDedup.get(eventName)!;
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

    const result = new Map<CapiEventName, CapiEventStats>();
    for (const eventName of ["ViewContent", "InitiateCheckout", "Purchase"] as const) {
        const dedup = perEventDedup.get(eventName)!;
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

        result.set(eventName, {
            event_name: eventName,
            total: dedup.size,
            success,
            pending,
            running,
            failed,
            last_seen_at: perEventLastSeen.get(eventName) ?? null,
        });
    }

    return result;
}

async function computeAnalyticsPayload(range: DateRange, campaignLevel: CampaignBreakdownLevel) {
    const db = adminClient();

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
        throw new Error(funnelErr.message);
    }
    let funnelData = buildFunnelSeries(range, funnelDataRaw ?? []);

    // 2. Fetch Revenue source breakdown in the selected period
    const { data: revenueOrders, error: revErr } = await db
        .from("orders")
        .select("order_ref, campaign, page_url, product_code, status, amount, created_at, fbclid, fbp, client_ip, client_ua")
        .gte("created_at", range.fromTs)
        .lt("created_at", range.toExclusiveTs)
        .limit(50000);

    if (revErr) {
        console.error("Analytics Revenue error:", revErr);
        throw new Error(revErr.message);
    }
    const revenueOrderRows = (revenueOrders ?? []) as Array<{
        order_ref: string | null;
        campaign: string | null;
        page_url: string | null;
        product_code: string | null;
        status: string | null;
        amount: number | null;
        created_at: string | null;
        fbclid: string | null;
        fbp: string | null;
        client_ip: string | null;
        client_ua: string | null;
    }>;
    const revenueMap = new Map<string, CampaignBreakdownRow>();
    const productMap = new Map<string, Omit<ProductBreakdownRow, "share_revenue_percent">>();
    const ordersCreatedByDay = new Map<string, number>();
    const ordersPaidByDay = new Map<string, number>();
    const revenueByDay = new Map<string, number>();
    const resolveRowByAliases = (aliases: string[]): CampaignBreakdownRow | null => {
        for (const alias of aliases) {
            if (!alias || !alias.trim()) continue;
            const exact = campaignMergeKey(alias);
            const byExact = revenueMap.get(exact);
            if (byExact) return byExact;
            const loose = campaignLooseKey(alias);
            if (loose) {
                const byLoose = revenueMap.get(`loose:${loose}`);
                if (byLoose) return byLoose;
            }
        }
        return null;
    };
    const registerRowAliases = (row: CampaignBreakdownRow, aliases: string[]) => {
        for (const alias of aliases) {
            if (!alias || !alias.trim()) continue;
            const exact = campaignMergeKey(alias);
            revenueMap.set(exact, row);
            const loose = campaignLooseKey(alias);
            if (loose) revenueMap.set(`loose:${loose}`, row);
        }
    };

    let metaRowsForLevel: MetaBreakdownInputRow[] = [];
    if (campaignLevel === "ad") {
        const { data: metaAdRowsRaw, error: metaAdErr } = await db
            .from("analytics_meta_ad_daily")
            .select("ad_id, ad_name, view_content, reach, impressions, spend, currency")
            .gte("day", range.from)
            .lte("day", range.to)
            .limit(100000);
        if (metaAdErr) {
            console.warn("Analytics Meta ad warning:", metaAdErr.message);
            const { data: metaAdsetRowsRaw, error: metaAdsetErr } = await db
                .from("analytics_meta_adset_daily")
                .select("adset_id, adset_name, view_content, reach, impressions, spend, currency")
                .gte("day", range.from)
                .lte("day", range.to)
                .limit(100000);
            if (metaAdsetErr) {
                console.warn("Analytics Meta adset warning:", metaAdsetErr.message);
            } else {
                metaRowsForLevel = (metaAdsetRowsRaw ?? []).map((row) => ({
                    source_id: normalizeCampaignSource(row.adset_id, ""),
                    source_name: normalizeCampaignSource(row.adset_name, ""),
                    view_content: asFiniteNumber(row.view_content),
                    reach: asFiniteNumber(row.reach),
                    impressions: asFiniteNumber(row.impressions),
                    spend: asFiniteNumber(row.spend),
                    currency: normalizeCampaignSource(row.currency, "UAH"),
                }));
            }
        } else {
            metaRowsForLevel = (metaAdRowsRaw ?? []).map((row) => ({
                source_id: normalizeCampaignSource(row.ad_id, ""),
                source_name: normalizeCampaignSource(row.ad_name, ""),
                view_content: asFiniteNumber(row.view_content),
                reach: asFiniteNumber(row.reach),
                impressions: asFiniteNumber(row.impressions),
                spend: asFiniteNumber(row.spend),
                currency: normalizeCampaignSource(row.currency, "UAH"),
            }));
        }
    } else {
        const { data: metaAdsetRowsRaw, error: metaAdsetErr } = await db
            .from("analytics_meta_adset_daily")
            .select("adset_id, adset_name, view_content, reach, impressions, spend, currency")
            .gte("day", range.from)
            .lte("day", range.to)
            .limit(100000);
        if (metaAdsetErr) {
            console.warn("Analytics Meta adset warning:", metaAdsetErr.message);
            const { data: metaCampaignRowsRaw, error: metaCampaignErr } = await db
                .from("analytics_meta_campaign_daily")
                .select("campaign_id, campaign_name, view_content, reach, impressions, spend, currency")
                .gte("day", range.from)
                .lte("day", range.to)
                .limit(100000);
            if (metaCampaignErr) {
                console.warn("Analytics Meta campaign warning:", metaCampaignErr.message);
            } else {
                metaRowsForLevel = (metaCampaignRowsRaw ?? []).map((row) => ({
                    source_id: normalizeCampaignSource(row.campaign_id, ""),
                    source_name: normalizeCampaignSource(row.campaign_name, ""),
                    view_content: asFiniteNumber(row.view_content),
                    reach: asFiniteNumber(row.reach),
                    impressions: asFiniteNumber(row.impressions),
                    spend: asFiniteNumber(row.spend),
                    currency: normalizeCampaignSource(row.currency, "UAH"),
                }));
            }
        } else {
            metaRowsForLevel = (metaAdsetRowsRaw ?? []).map((row) => ({
                source_id: normalizeCampaignSource(row.adset_id, ""),
                source_name: normalizeCampaignSource(row.adset_name, ""),
                view_content: asFiniteNumber(row.view_content),
                reach: asFiniteNumber(row.reach),
                impressions: asFiniteNumber(row.impressions),
                spend: asFiniteNumber(row.spend),
                currency: normalizeCampaignSource(row.currency, "UAH"),
            }));
        }
    }

    // Alias map to resolve order-side ids/names to Meta canonical names.
    const metaAliasToName = new Map<string, string>();
    const knownMetaIds = new Set<string>();
    for (const row of metaRowsForLevel) {
        const canonical = preferredSourceLabel(row.source_name, row.source_id, "meta");
        if (row.source_id) knownMetaIds.add(row.source_id);
        for (const alias of [row.source_id, row.source_name]) {
            if (!alias) continue;
            const exact = campaignMergeKey(alias);
            if (exact) metaAliasToName.set(exact, canonical);
            const loose = campaignLooseKey(alias);
            if (loose) metaAliasToName.set(`loose:${loose}`, canonical);
        }
    }
    const resolveMetaCanonicalName = (rawSource: string): string | null => {
        const exact = campaignMergeKey(rawSource);
        const byExact = metaAliasToName.get(exact);
        if (byExact) return byExact;
        const loose = campaignLooseKey(rawSource);
        if (!loose) return null;
        return metaAliasToName.get(`loose:${loose}`) ?? null;
    };

    let paidRevenueFact = 0;
    for (const row of revenueOrderRows) {
        const createdAt = typeof row.created_at === "string" ? row.created_at : null;
        const dayKey = createdAt ? getIsoDateInTimeZone(new Date(createdAt), ADMIN_ANALYTICS_TZ) : null;
        const campaignParam = extractUrlQueryParam(row.page_url, "utm_campaign");
        const contentParam = extractUrlQueryParam(row.page_url, "utm_content");
        const termParam = extractUrlQueryParam(row.page_url, "utm_term");
        const rawSource = resolveOrderBreakdownSource(campaignLevel, {
            campaignParam,
            contentParam,
            termParam,
            fallbackCampaign: row.campaign,
            knownMetaIds,
        });
        const source = resolveMetaCanonicalName(rawSource) ?? rawSource;
        const productCode = normalizeCampaignSource(row.product_code, "unknown");
        const existing = resolveRowByAliases([source]) ?? {
            source_campaign: source,
            total_orders: 0,
            paid_orders: 0,
            total_revenue: 0,
            view_content: 0,
            impressions: 0,
            reach: 0,
            spend: 0,
            currency: "UAH",
        };
        const productExisting = productMap.get(productCode) ?? {
            product_code: productCode,
            total_orders: 0,
            paid_orders: 0,
            total_revenue: 0,
        };
        existing.total_orders += 1;
        productExisting.total_orders += 1;
        if (dayKey) {
            ordersCreatedByDay.set(dayKey, (ordersCreatedByDay.get(dayKey) ?? 0) + 1);
        }
        if (row.status === "paid" || row.status === "completed") {
            existing.paid_orders += 1;
            productExisting.paid_orders += 1;
            const paidAmount = asFiniteNumber(row.amount);
            existing.total_revenue += paidAmount;
            productExisting.total_revenue += paidAmount;
            paidRevenueFact += paidAmount;
            if (dayKey) {
                ordersPaidByDay.set(dayKey, (ordersPaidByDay.get(dayKey) ?? 0) + 1);
                revenueByDay.set(dayKey, (revenueByDay.get(dayKey) ?? 0) + paidAmount);
            }
        }
        registerRowAliases(existing, [source]);
        productMap.set(productCode, productExisting);
    }

    const mergeMetaIntoRevenueMap = (
        rows: Array<{
            source_id?: unknown;
            source_name?: unknown;
            view_content?: unknown;
            reach?: unknown;
            impressions?: unknown;
            spend?: unknown;
            currency?: unknown;
        }>,
        sourceFallback: string
    ) => {
        for (const row of rows) {
            const sourceId = normalizeCampaignSource(row.source_id, "");
            const sourceName = normalizeCampaignSource(row.source_name, "");
            const source = sourceName || sourceId || sourceFallback;
            const aliases = [source, sourceId, sourceName].filter((value) => Boolean(value && value.trim()));
            const existing = resolveRowByAliases(aliases) ?? {
                source_campaign: source,
                total_orders: 0,
                paid_orders: 0,
                total_revenue: 0,
                view_content: 0,
                impressions: 0,
                reach: 0,
                spend: 0,
                currency: "UAH",
            };
            if (isLikelyMetaId(existing.source_campaign) && sourceName && !isLikelyMetaId(sourceName)) {
                existing.source_campaign = sourceName;
            }
            existing.view_content += asFiniteNumber(row.view_content);
            existing.impressions += asFiniteNumber(row.impressions);
            existing.reach += asFiniteNumber(row.reach);
            existing.spend += asFiniteNumber(row.spend);
            if (typeof row.currency === "string" && row.currency.trim()) {
                existing.currency = row.currency.trim();
            }
            registerRowAliases(existing, aliases);
        }
    };

    mergeMetaIntoRevenueMap(metaRowsForLevel, "meta (no utm_campaign)");

    const revenueData = Array.from(new Set(revenueMap.values()))
        .sort((a, b) => {
            if (b.total_revenue !== a.total_revenue) return b.total_revenue - a.total_revenue;
            if (b.spend !== a.spend) return b.spend - a.spend;
            return b.total_orders - a.total_orders;
        })
        .slice(0, 20);
    const productData = Array.from(productMap.values())
        .map((row) => ({
            ...row,
            share_revenue_percent: Number(safeDivide(row.total_revenue * 100, paidRevenueFact).toFixed(2)),
        }))
        .sort((a, b) => {
            if (b.total_revenue !== a.total_revenue) return b.total_revenue - a.total_revenue;
            if (b.paid_orders !== a.paid_orders) return b.paid_orders - a.paid_orders;
            return b.total_orders - a.total_orders;
        });

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
        .order("synced_at", { ascending: false })
        .limit(366);
    if (pixelDailyErr) {
        console.warn("Analytics Pixel daily warning:", pixelDailyErr.message);
    }

    // Deduplicate per day: keep latest synced snapshot for that day.
    const pixelDailyByDay = new Map<string, {
        day: string;
        view_content: number;
        initiate_checkout: number;
        purchase: number;
        synced_at: string | null;
    }>();
    for (const rawRow of pixelRows ?? []) {
        const day = typeof rawRow.day === "string" ? rawRow.day : null;
        if (!day) continue;
        const nextSyncedAt = typeof rawRow.synced_at === "string" ? rawRow.synced_at : null;
        const current = pixelDailyByDay.get(day);
        const currentSyncedAt = current?.synced_at ?? null;
        const shouldReplace =
            !current ||
            (nextSyncedAt && currentSyncedAt ? nextSyncedAt > currentSyncedAt : Boolean(nextSyncedAt));
        if (!shouldReplace) continue;
        pixelDailyByDay.set(day, {
            day,
            view_content: asFiniteNumber(rawRow.view_content),
            initiate_checkout: asFiniteNumber(rawRow.initiate_checkout),
            purchase: asFiniteNumber(rawRow.purchase),
            synced_at: nextSyncedAt,
        });
    }
    const pixelDailyRows = Array.from(pixelDailyByDay.values());

    const pixelDailyAggregate: PixelDailyAggregate = pixelDailyRows.reduce<PixelDailyAggregate>(
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
    const pixelDailyDaysPresent = pixelDailyRows.length;
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

    // 6. CAPI transport stats come from one shared jobs read instead of three scans.
    const capiEventStats = await getCapiEventStatsMap(db, range);
    const viewContentStats = capiEventStats.get("ViewContent")!;
    const initiateCheckoutStats = capiEventStats.get("InitiateCheckout")!;
    const purchaseStats = capiEventStats.get("Purchase")!;

    // 7. Access granted proxy (token consumed)
    const { count: accessGrantedCount, error: accessErr } = await db
        .from("events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", range.fromTs)
        .lt("created_at", range.toExclusiveTs)
        .eq("type", "token_consumed");
    if (accessErr) {
        console.error("Analytics access count error:", accessErr);
        throw new Error(accessErr.message);
    }

    // 7.5 Business-fact totals stay exact and must not inherit the 50k row cap
    // used for breakdown/detail datasets.
    const { count: ordersCreatedCount, error: ordersCreatedErr } = await db
        .from("orders")
        .select("id", { count: "exact", head: true })
        .gte("created_at", range.fromTs)
        .lt("created_at", range.toExclusiveTs);
    if (ordersCreatedErr) {
        console.error("Analytics orders created count error:", ordersCreatedErr);
        throw new Error(ordersCreatedErr.message);
    }

    const { count: paidOrdersCount, error: paidErr } = await db
        .from("orders")
        .select("id", { count: "exact", head: true })
        .gte("created_at", range.fromTs)
        .lt("created_at", range.toExclusiveTs)
        .in("status", ["paid", "completed"]);
    if (paidErr) {
        console.error("Analytics paid count error:", paidErr);
        throw new Error(paidErr.message);
    }
    const ordersCreatedTotal = ordersCreatedCount ?? 0;
    const paidOrdersTotal = paidOrdersCount ?? 0;

    const { count: scrollDepth50Count, error: scrollErr } = await db
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("type", "scroll_depth_50")
        .gte("created_at", range.fromTs)
        .lt("created_at", range.toExclusiveTs);
    if (scrollErr) {
        console.error("Analytics scroll depth count error:", scrollErr);
        throw new Error(scrollErr.message);
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
        throw new Error(alignedInitiateErr.message);
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
        throw new Error(localViewErr.message);
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
        localViewContent > 0 ? Math.max(localViewContent, ordersCreatedTotal) : localViewContent;
    const fallbackViewContent = pixelResult.totals?.view_content ?? viewContentStats.total;
    const hasPixelDailyViewContent = pixelDailyAggregate.view_content > 0;
    const referencePixelViewContent = pixelResult.totals?.view_content ?? null;
    const businessInitiateCheckout = ordersCreatedTotal;
    const pixelStatsUnavailable = (pixelResult.reason ?? "").startsWith("pixel_stats_api_error");
    const pixelDailyImplausibleForFunnel =
        hasPixelDailyViewContent &&
        businessInitiateCheckout > 0 &&
        pixelDailyAggregate.view_content < businessInitiateCheckout;
    const pixelDailyImplausiblyHighVsReference =
        hasPixelDailyViewContent &&
        referencePixelViewContent !== null &&
        referencePixelViewContent > 0 &&
        pixelDailyAggregate.view_content > Math.round(referencePixelViewContent * 1.5);
    const preferReferencePixelViewContent =
        referencePixelViewContent !== null &&
        referencePixelViewContent > 0 &&
        (
            !hasPixelDailyViewContent ||
            pixelDailyCoveragePercent < 80 ||
            pixelDailyAggregate.view_content < Math.round(referencePixelViewContent * 0.7) ||
            pixelDailyImplausiblyHighVsReference
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
        initiate_checkout: ordersCreatedTotal,
        // Purchase remains business-fact from paid/completed orders.
        purchase: paidOrdersTotal,
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

    const paidWindowFetchLimit = 50000;
    const [paidPaymentsRes, paidEventsRes] = await Promise.all([
        db
            .from("payments")
            .select("order_ref, status, created_at")
            .in("status", ["paid", "completed"])
            .gte("created_at", range.fromTs)
            .lt("created_at", range.toExclusiveTs)
            .order("created_at", { ascending: false })
            .limit(paidWindowFetchLimit),
        db
            .from("events")
            .select("order_ref, created_at, type")
            .in("type", ["purchase_completed", "payment_approved"])
            .gte("created_at", range.fromTs)
            .lt("created_at", range.toExclusiveTs)
            .order("created_at", { ascending: false })
            .limit(paidWindowFetchLimit),
    ]);
    if (paidPaymentsRes.error) {
        console.warn("Analytics paid payments warning:", paidPaymentsRes.error.message);
    }
    if (paidEventsRes.error) {
        console.warn("Analytics paid events warning:", paidEventsRes.error.message);
    }

    const paidWindowOrders = buildPaidWindowOrders(
        (paidPaymentsRes.data ?? []) as Array<{ order_ref?: unknown; status?: unknown; created_at?: unknown }>,
        (paidEventsRes.data ?? []) as Array<{ order_ref?: unknown; created_at?: unknown }>
    );
    const paidAtByOrderRef = new Map<string, string>();
    for (const entry of paidWindowOrders) {
        paidAtByOrderRef.set(entry.order_ref, entry.paid_at);
    }
    const paidOrderRefs = paidWindowOrders.map((entry) => entry.order_ref);

    let qualityOrdersRows:
        | Array<{
              order_ref: string;
              created_at: string | null;
              status: string | null;
              fbclid: string | null;
              fbp: string | null;
              page_url: string | null;
              client_ip: string | null;
              client_ua: string | null;
          }>
        = [];
    let checkoutStartedRows:
        | Array<{
              order_ref: string | null;
              payload: unknown;
              created_at: string | null;
          }>
        = [];
    let purchaseJobByOrderRef = new Map<string, { status: string; created_at: string | null }>();
    let purchaseClientSignalOrderRefs = new Set<string>();

    if (paidOrderRefs.length > 0) {
        const [qualityOrdersRes, checkoutStartedRes, purchaseClientSignalRes] = await Promise.all([
            db
                .from("orders")
                .select("order_ref, created_at, status, fbclid, fbp, page_url, client_ip, client_ua")
                .in("status", ["paid", "completed"])
                .in("order_ref", paidOrderRefs)
                .limit(paidWindowFetchLimit),
            db
                .from("events")
                .select("order_ref, payload, created_at")
                .eq("type", "checkout_started")
                .in("order_ref", paidOrderRefs)
                .order("created_at", { ascending: false })
                .limit(paidWindowFetchLimit),
            db
                .from("events")
                .select("order_ref")
                .eq("type", "purchase_client_signal")
                .in("order_ref", paidOrderRefs)
                .gte("created_at", range.fromTs)
                .lt("created_at", range.toExclusiveTs)
                .limit(paidWindowFetchLimit),
        ]);
        if (qualityOrdersRes.error) {
            console.warn("Analytics quality series warning:", qualityOrdersRes.error.message);
        } else {
            qualityOrdersRows = (qualityOrdersRes.data ?? []) as typeof qualityOrdersRows;
        }
        if (checkoutStartedRes.error) {
            console.warn("Analytics checkout_started quality warning:", checkoutStartedRes.error.message);
        } else {
            checkoutStartedRows = (checkoutStartedRes.data ?? []) as typeof checkoutStartedRows;
        }
        if (purchaseClientSignalRes.error) {
            console.warn("Analytics purchase client signal warning:", purchaseClientSignalRes.error.message);
        } else {
            purchaseClientSignalOrderRefs = new Set(
                (purchaseClientSignalRes.data ?? [])
                    .map((row) => (typeof row.order_ref === "string" ? row.order_ref : null))
                    .filter((value): value is string => Boolean(value))
            );
        }
        try {
            purchaseJobByOrderRef = await fetchLatestPurchaseJobsByOrderRefs(db, paidOrderRefs);
        } catch (error) {
            console.warn(
                "Analytics purchase transport warning:",
                error instanceof Error ? error.message : String(error)
            );
        }
    }

    const checkoutTrackingByOrderRef = new Map<string, { fbc: string | null }>();
    for (const row of checkoutStartedRows ?? []) {
        const orderRef = typeof row.order_ref === "string" ? row.order_ref : null;
        if (!orderRef || checkoutTrackingByOrderRef.has(orderRef)) continue;
        checkoutTrackingByOrderRef.set(orderRef, {
            fbc: payloadString(row.payload, "fbc"),
        });
    }

    const qualitySeriesMap = new Map<string, QualitySeriesRow>();
    for (const row of qualityOrdersRows ?? []) {
        const paidAt = paidAtByOrderRef.get(row.order_ref) ?? null;
        if (!paidAt) continue;
        const orderRef = typeof row.order_ref === "string" ? row.order_ref : null;
        const checkoutTracking = orderRef ? checkoutTrackingByOrderRef.get(orderRef) : null;
        const day = paidAt.slice(0, 10);
        const existing = qualitySeriesMap.get(day) ?? {
            date: day,
            paid_orders: 0,
            missing_fbc_raw: 0,
            recoverable_fbc_from_fbclid: 0,
            truly_missing_fbc: 0,
            missing_fbclid: 0,
            missing_fbp: 0,
            missing_page_url: 0,
            missing_client_ip: 0,
            missing_client_ua: 0,
        };
        const rawFbc = checkoutTracking?.fbc ?? null;
        const resolvedFbc = resolveFbc({
            fbc: rawFbc,
            fbclid: row.fbclid,
            creationTimeSeconds: toUnixSeconds(paidAt),
        });
        existing.paid_orders += 1;
        if (!rawFbc) existing.missing_fbc_raw += 1;
        if (!rawFbc && row.fbclid && resolvedFbc) existing.recoverable_fbc_from_fbclid += 1;
        if (!resolvedFbc) existing.truly_missing_fbc += 1;
        if (!row.fbclid) existing.missing_fbclid += 1;
        if (!row.fbp) existing.missing_fbp += 1;
        if (!row.page_url) existing.missing_page_url += 1;
        if (!row.client_ip) existing.missing_client_ip += 1;
        if (!row.client_ua) existing.missing_client_ua += 1;
        qualitySeriesMap.set(day, existing);
    }

    const stalePendingThresholdMs = 2 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const purchase_transport = (qualityOrdersRows ?? []).reduce<PurchaseTransportRow>(
        (acc, row) => {
            const orderRef = typeof row.order_ref === "string" ? row.order_ref : null;
            acc.total_paid_orders += 1;
            if (!orderRef) {
                acc.missing_job += 1;
                return acc;
            }
            const status = purchaseJobByOrderRef.get(orderRef);
            if (!status) {
                acc.missing_job += 1;
            } else if (status.status === "success") {
                acc.success += 1;
                if (status.created_at && (!acc.last_success_at || status.created_at > acc.last_success_at)) {
                    acc.last_success_at = status.created_at;
                }
            } else {
                if (status.status === "pending") acc.pending += 1;
                if (status.status === "running") acc.running += 1;
                if (status.status === "failed") acc.failed += 1;
                if ((status.status === "pending" || status.status === "running") && status.created_at) {
                    const lastPendingMs = Date.parse(status.created_at);
                    if (Number.isFinite(lastPendingMs) && nowMs - lastPendingMs >= stalePendingThresholdMs) {
                        acc.stale_pending += 1;
                    }
                }
            }

            if (purchaseClientSignalOrderRefs.has(orderRef)) {
                acc.client_signal += 1;
            } else {
                acc.missing_client_signal += 1;
            }
            return acc;
        },
        {
            total_paid_orders: 0,
            success: 0,
            pending: 0,
            running: 0,
            failed: 0,
            missing_job: 0,
            stale_pending: 0,
            client_signal: 0,
            missing_client_signal: 0,
            last_success_at: null,
        }
    );

    const quality_series = Array.from(qualitySeriesMap.values()).sort((a, b) =>
        a.date.localeCompare(b.date)
    );
    const quality_gaps: QualityGaps | null = quality_series.length > 0
        ? quality_series.reduce<QualityGaps>(
            (acc, row) => {
                acc.paid_missing_fbc_raw += row.missing_fbc_raw;
                acc.paid_recoverable_fbc_from_fbclid += row.recoverable_fbc_from_fbclid;
                acc.paid_truly_missing_fbc += row.truly_missing_fbc;
                acc.paid_missing_fbclid += row.missing_fbclid;
                acc.paid_missing_fbp += row.missing_fbp;
                acc.paid_missing_page_url += row.missing_page_url;
                acc.paid_missing_client_ip += row.missing_client_ip;
                acc.paid_missing_client_ua += row.missing_client_ua;
                return acc;
            },
            {
                snapshot_date: qualityRow?.snapshot_date ?? new Date().toISOString().slice(0, 10),
                paid_missing_fbc_raw: 0,
                paid_recoverable_fbc_from_fbclid: 0,
                paid_truly_missing_fbc: 0,
                paid_missing_fbclid: 0,
                paid_missing_fbp: 0,
                paid_missing_page_url: 0,
                paid_missing_client_ip: 0,
                paid_missing_client_ua: 0,
            }
        )
        : null;

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

    return {
        period: {
            from: range.from,
            to: range.to,
        },
        campaigns_level: campaignLevel,
        funnel: funnelData,
        campaigns: revenueData,
        products: productData,
        summary: {
            totalLeads,
            totalOrders: ordersCreatedCount,
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
            pixel_daily_implausibly_high_vs_reference: pixelDailyImplausiblyHighVsReference,
            pixel_daily_low_coverage_when_pixel_unavailable: pixelDailyLowCoverageWhenPixelUnavailable,
            prefer_reference_pixel_view_content: preferReferencePixelViewContent,
            resolved_view_content: resolvedViewContent,
            pixel_reason: pixelResult.reason ?? null,
            reference_pixel_view_content: pixelResult.totals?.view_content ?? null,
            transport_capi_view_content: viewContentStats.total,
            reference_pixel_initiate_checkout: pixelResult.totals?.initiate_checkout ?? null,
            business_initiate_checkout: ordersCreatedTotal,
            transport_capi_initiate_checkout: initiateCheckoutStats.total,
            pixel_preview: pixelResult.preview ?? null,
            pixel_requested_range: pixelResult.requested_range ?? null,
        },
        quality_gaps,
        quality_series,
        purchase_transport,
        freshness,
        kpis: {
            cpa: toFixed2(cpa),
            cpc: toFixed2(cpc),
            ctr_percent: toFixed2(ctrPercent),
            roas: toFixed2(roas),
            roi_percent: toFixed2(roiPercent),
        },
    };
}

function getCachedAnalyticsPayload(range: DateRange, campaignLevel: CampaignBreakdownLevel) {
    return unstable_cache(
        async () => computeAnalyticsPayload(range, campaignLevel),
        ["admin-analytics-v2", range.from, range.to, campaignLevel],
        {
            // Short shared cache reduces repeated Supabase scans and Meta API work
            // while keeping the admin dashboard effectively fresh.
            revalidate: 120,
        }
    )();
}

export async function GET(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

    const range = toDateRange(req.nextUrl.searchParams);
    const campaignLevel = campaignBreakdownLevelFromQuery(req.nextUrl.searchParams);
    try {
        const payload = await getCachedAnalyticsPayload(range, campaignLevel);
        return NextResponse.json(payload);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return serverErrorResponse(message);
    }
}
