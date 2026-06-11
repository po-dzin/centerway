import { adminClient } from "@/lib/auth/adminClient";
import { sendConfirmedSaleTelegramReport } from "@/lib/reporting/analyticsReports";
import { sendCapiEvent } from "@/lib/tracking/capi";
import type { CapiEventPayload } from "@/lib/tracking/capi";
import { normalizeTrackingString } from "@/lib/tracking/metaClickIds";
import { getErrorMessage } from "@/lib/errors";
import { processDoshaReminderJob } from "@/lib/doshaReminder";

// Simple job registry
type JobHandler = (payload: unknown) => Promise<void>;

type PendingPurchaseCapiJobPayload = {
    event_name: "Purchase";
    order_ref: string;
    payment_event_time?: number;
    fbc_creation_time_seconds?: number;
    value?: number;
    currency?: string;
    email?: string | null;
    phone?: string | null;
};

type TelegramSaleReportJobPayload = {
    order_ref: string;
};

function isCapiEventPayload(payload: unknown): payload is CapiEventPayload {
    if (!payload || typeof payload !== "object") return false;
    const p = payload as Partial<CapiEventPayload>;
    return (
        typeof p.event_name === "string" &&
        typeof p.event_id === "string" &&
        typeof p.event_time === "number"
    );
}

function isPendingPurchaseCapiJobPayload(payload: unknown): payload is PendingPurchaseCapiJobPayload {
    if (!payload || typeof payload !== "object") return false;
    const p = payload as Partial<PendingPurchaseCapiJobPayload>;
    return p.event_name === "Purchase" && typeof p.order_ref === "string" && p.order_ref.trim().length > 0;
}

function isTelegramSaleReportJobPayload(payload: unknown): payload is TelegramSaleReportJobPayload {
    if (!payload || typeof payload !== "object") return false;
    const p = payload as Partial<TelegramSaleReportJobPayload>;
    return typeof p.order_ref === "string" && p.order_ref.trim().length > 0;
}

function parseIsoToUnixSeconds(value: string | null | undefined): number | null {
    if (!value) return null;
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.floor(parsed / 1000);
}

async function buildPurchaseCapiEventPayload(payload: PendingPurchaseCapiJobPayload): Promise<CapiEventPayload> {
    const db = adminClient();
    const orderRef = payload.order_ref.trim();
    const [orderTrackingRes, initiateCheckoutJobRes, checkoutStartedEventRes] = await Promise.all([
        db
            .from("orders")
            .select("product_code, amount, currency, fbp, fbclid, client_ip, client_ua, page_url, created_at")
            .eq("order_ref", orderRef)
            .maybeSingle(),
        db
            .from("jobs")
            .select("payload, created_at")
            .eq("type", "meta:capi")
            .contains("payload", { event_name: "InitiateCheckout", order_ref: orderRef })
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        db
            .from("events")
            .select("payload, created_at")
            .eq("type", "checkout_started")
            .eq("order_ref", orderRef)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
    ]);

    if (orderTrackingRes.error) {
        throw new Error(`purchase_capi_order_read_failed:${orderTrackingRes.error.message}`);
    }
    if (initiateCheckoutJobRes.error) {
        throw new Error(`purchase_capi_checkout_job_read_failed:${initiateCheckoutJobRes.error.message}`);
    }
    if (checkoutStartedEventRes.error) {
        throw new Error(`purchase_capi_checkout_event_read_failed:${checkoutStartedEventRes.error.message}`);
    }

    const orderTracking = orderTrackingRes.data;
    const initiatePayload = (initiateCheckoutJobRes.data?.payload ?? null) as Record<string, unknown> | null;
    const checkoutPayload = (checkoutStartedEventRes.data?.payload ?? null) as Record<string, unknown> | null;

    return {
        event_name: "Purchase",
        event_id: `purchase_${orderRef}`,
        event_time: payload.payment_event_time ?? Math.floor(Date.now() / 1000),
        fbc_creation_time_seconds:
            parseIsoToUnixSeconds(typeof orderTracking?.created_at === "string" ? orderTracking.created_at : null) ??
            parseIsoToUnixSeconds(typeof initiateCheckoutJobRes.data?.created_at === "string" ? initiateCheckoutJobRes.data.created_at : null) ??
            parseIsoToUnixSeconds(typeof checkoutStartedEventRes.data?.created_at === "string" ? checkoutStartedEventRes.data.created_at : null) ??
            payload.payment_event_time ??
            Math.floor(Date.now() / 1000),
        value: typeof orderTracking?.amount === "number" ? orderTracking.amount : payload.value,
        currency:
            normalizeTrackingString(orderTracking?.currency) ??
            normalizeTrackingString(payload.currency) ??
            "UAH",
        order_ref: orderRef,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        fbp:
            normalizeTrackingString(orderTracking?.fbp) ??
            normalizeTrackingString(initiatePayload?.fbp) ??
            normalizeTrackingString(checkoutPayload?.fbp),
        fbc:
            normalizeTrackingString(initiatePayload?.fbc) ??
            normalizeTrackingString(checkoutPayload?.fbc),
        fbclid:
            normalizeTrackingString(orderTracking?.fbclid) ??
            normalizeTrackingString(initiatePayload?.fbclid) ??
            normalizeTrackingString(checkoutPayload?.fbclid),
        ip_address:
            normalizeTrackingString(orderTracking?.client_ip) ??
            normalizeTrackingString(initiatePayload?.ip_address) ??
            normalizeTrackingString(checkoutPayload?.client_ip),
        user_agent:
            normalizeTrackingString(orderTracking?.client_ua) ??
            normalizeTrackingString(initiatePayload?.user_agent) ??
            normalizeTrackingString(checkoutPayload?.client_ua) ??
            normalizeTrackingString(checkoutPayload?.user_agent),
        event_source_url:
            normalizeTrackingString(orderTracking?.page_url) ??
            normalizeTrackingString(initiatePayload?.event_source_url) ??
            normalizeTrackingString(checkoutPayload?.page_url),
        action_source: "website",
        content_name: normalizeTrackingString(orderTracking?.product_code) ?? undefined,
        content_type: normalizeTrackingString(orderTracking?.product_code) ? "product" : undefined,
        content_ids: normalizeTrackingString(orderTracking?.product_code)
            ? [normalizeTrackingString(orderTracking?.product_code)!]
            : undefined,
    };
}

const handlers: Record<string, JobHandler> = {
    "meta:capi": async (payload) => {
        if (isCapiEventPayload(payload)) {
            await sendCapiEvent(payload);
            return;
        }
        if (isPendingPurchaseCapiJobPayload(payload)) {
            const resolvedPayload = await buildPurchaseCapiEventPayload(payload);
            await sendCapiEvent(resolvedPayload);
            return;
        }
        throw new Error("Invalid payload for meta:capi job");
    },
    "dosha:reminder": async (payload) => {
        await processDoshaReminderJob(payload);
    },
    "reporting:telegram-sale": async (payload) => {
        if (!isTelegramSaleReportJobPayload(payload)) {
            throw new Error("Invalid payload for reporting:telegram-sale job");
        }
        await sendConfirmedSaleTelegramReport(payload.order_ref);
    },
};


export function registerJobHandler(type: string, handler: JobHandler) {
    handlers[type] = handler;
}

// Ensure the execution doesn't block forever and locks jobs
export async function processPendingJobs(limit = 10) {
    const db = adminClient();
    const nowIso = new Date().toISOString();

    // 1. Fetch pending jobs that are due
    const { data: jobs, error } = await db
        .from("jobs")
        .select("*")
        .in("status", ["pending", "failed"])
        .or(`run_at.is.null,run_at.lte.${nowIso}`)
        .lt("attempts", 3) // max 3 attempts
        .order("run_at", { ascending: true })
        .limit(limit);

    if (error || !jobs || jobs.length === 0) return 0;

    // 2. Mark as running
    const jobIds = jobs.map(j => j.id);
    await db.from("jobs").update({ status: "running" }).in("id", jobIds);

    let processed = 0;

    // 3. Process jobs in parallel chunks (e.g. 10 at a time)
    const chunkSize = 10;
    for (let i = 0; i < jobs.length; i += chunkSize) {
        const chunk = jobs.slice(i, i + chunkSize);
        await Promise.allSettled(
            chunk.map(async (job) => {
                try {
                    const handler = handlers[job.type];
                    if (!handler) {
                        throw new Error(`No handler registered for job type: ${job.type}`);
                    }

                    await handler(job.payload);

                    // Success
                    await db.from("jobs").update({
                        status: "success",
                        error_text: null
                    }).eq("id", job.id);
                    processed++;

                } catch (err: unknown) {
                    console.error(`Job [${job.id}] failed:`, err);

                    // Calculate next attempt (exponential backoff)
                    const attempts = job.attempts + 1;
                    const nextRunAt = new Date();
                    nextRunAt.setMinutes(nextRunAt.getMinutes() + Math.pow(5, attempts)); // wait 5m, 25m, 125m

                    await db.from("jobs").update({
                        status: attempts >= 3 ? "failed" : "pending",
                        attempts: attempts,
                        error_text: getErrorMessage(err),
                        run_at: nextRunAt.toISOString()
                    }).eq("id", job.id);
                }
            })
        );
    }

    return processed;
}
