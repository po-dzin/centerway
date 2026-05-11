import { NextRequest, NextResponse } from "next/server";
import {
  badRequestResponse,
  requireAdminSession,
  serverErrorResponse,
  unauthorizedResponse,
} from "@/lib/api/adminRoute";
import { adminClient } from "@/lib/auth/adminClient";
import { extractPaymentMeta } from "@/lib/paymentMeta";
import { sendCapiEvent, type CapiEventPayload } from "@/lib/tracking/capi";
import { normalizeTrackingString } from "@/lib/tracking/metaClickIds";
import { getErrorMessage } from "@/lib/errors";

type BackfillMode = "dry_run" | "queue" | "send";

type BackfillBody = {
  since?: unknown;
  until?: unknown;
  mode?: unknown;
  only_missing?: unknown;
  limit?: unknown;
};

type OrderRow = {
  order_ref: string;
  product_code: string | null;
  amount: number | string | null;
  currency: string | null;
  status: string | null;
  customer_id: string | null;
  fbp: string | null;
  fbclid: string | null;
  client_ip: string | null;
  client_ua: string | null;
  page_url: string | null;
  created_at: string | null;
};

type PaymentRow = {
  order_ref: string | null;
  status: string | null;
  raw_payload: unknown;
  created_at: string | null;
};

type EventRow = {
  order_ref: string | null;
  payload: Record<string, unknown> | null;
  created_at: string | null;
};

type JobRow = {
  id: string;
  status: "pending" | "running" | "success" | "failed";
  attempts: number;
  error_text: string | null;
  payload: Record<string, unknown> | null;
  created_at: string | null;
  run_at: string | null;
};

type CustomerRow = {
  id: string;
  email: string | null;
  phone: string | null;
};

type PaidWindowEntry = {
  order_ref: string;
  paid_at: string;
  source: "payment" | "event";
};

type PurchaseBackfillCandidate = {
  order_ref: string;
  paid_at: string | null;
  payload: CapiEventPayload;
  existing_job: JobRow | null;
  diagnosis:
    | "missing_job"
    | "job_failed"
    | "job_pending"
    | "job_running"
    | "job_success"
    | "missing_event_time";
};

type BackfillOrderResult = {
  order_ref: string;
  diagnosis: PurchaseBackfillCandidate["diagnosis"];
  action:
    | "preview"
    | "queued_new"
    | "requeued_failed"
    | "skipped_success"
    | "skipped_running"
    | "skipped_pending"
    | "sent"
    | "send_failed"
    | "invalid";
  paid_at: string | null;
  event_id: string;
  job_id: string | null;
  job_status: JobRow["status"] | "invalid" | null;
  attempts: number | null;
  error_text: string | null;
};

function asDateString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

function asMode(value: unknown): BackfillMode | null {
  if (value === undefined) return "dry_run";
  if (value === "dry_run" || value === "queue" || value === "send") return value;
  return null;
}

function asBoolean(value: unknown, defaultValue: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return defaultValue;
}

function asLimit(value: unknown, defaultValue: number, maxValue: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return Math.min(Math.floor(parsed), maxValue);
}

function toIsoDate(input: Date): string {
  return input.toISOString().slice(0, 10);
}

function shiftIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

function resolveDateWindow(sinceRaw?: unknown, untilRaw?: unknown) {
  const todayIso = toIsoDate(new Date());
  const defaultUntil = todayIso;
  const defaultSince = shiftIsoDate(todayIso, -6);
  const since = asDateString(sinceRaw) ?? defaultSince;
  const until = asDateString(untilRaw) ?? defaultUntil;
  const normalizedUntil = until >= since ? until : since;
  const clampedUntil = normalizedUntil > todayIso ? todayIso : normalizedUntil;
  const clampedSince = since > clampedUntil ? clampedUntil : since;

  return {
    since: clampedSince,
    until: clampedUntil,
    fromTs: `${clampedSince}T00:00:00.000Z`,
    toExclusiveTs: `${shiftIsoDate(clampedUntil, 1)}T00:00:00.000Z`,
  };
}

function parseEventTimeSeconds(isoString: string | null): number | null {
  if (!isoString) return null;
  const parsed = Date.parse(isoString);
  if (!Number.isFinite(parsed)) return null;
  return Math.floor(parsed / 1000);
}

function payloadString(payload: Record<string, unknown> | null | undefined, key: string): string | null {
  return normalizeTrackingString(payload?.[key]);
}

function computeRetryState(currentAttempts: number) {
  const attempts = currentAttempts + 1;
  const nextRunAt = new Date();
  nextRunAt.setMinutes(nextRunAt.getMinutes() + Math.pow(5, attempts));
  return {
    attempts,
    status: attempts >= 3 ? ("failed" as const) : ("pending" as const),
    run_at: nextRunAt.toISOString(),
  };
}

function compareIsoDesc(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? 1 : a > b ? -1 : 0;
}

function buildPaidWindowEntries(input: {
  payments: PaymentRow[];
  paymentEvents: (EventRow & { type?: string | null })[];
}): PaidWindowEntry[] {
  const byOrderRef = new Map<string, PaidWindowEntry>();

  for (const row of input.payments) {
    const orderRef = normalizeTrackingString(row.order_ref);
    const createdAt = normalizeTrackingString(row.created_at);
    if (!orderRef || !createdAt) continue;
    if (row.status !== "paid" && row.status !== "completed") continue;
    if (!byOrderRef.has(orderRef)) {
      byOrderRef.set(orderRef, {
        order_ref: orderRef,
        paid_at: createdAt,
        source: "payment",
      });
    }
  }

  for (const row of input.paymentEvents) {
    const orderRef = normalizeTrackingString(row.order_ref);
    const createdAt = normalizeTrackingString(row.created_at);
    if (!orderRef || !createdAt) continue;
    if (row.type !== "purchase_completed" && row.type !== "payment_approved") continue;
    if (!byOrderRef.has(orderRef)) {
      byOrderRef.set(orderRef, {
        order_ref: orderRef,
        paid_at: createdAt,
        source: "event",
      });
    }
  }

  return Array.from(byOrderRef.values()).sort((a, b) => compareIsoDesc(a.paid_at, b.paid_at));
}

async function updateJobForImmediateFailure(
  db: ReturnType<typeof adminClient>,
  jobId: string,
  currentAttempts: number,
  errorText: string
) {
  const retryState = computeRetryState(currentAttempts);
  await db
    .from("jobs")
    .update({
      status: retryState.status,
      attempts: retryState.attempts,
      error_text: errorText,
      run_at: retryState.run_at,
    })
    .eq("id", jobId);
}

async function fetchLatestCapiJobByOrderRef(
  db: ReturnType<typeof adminClient>,
  eventName: CapiEventPayload["event_name"],
  orderRef: string
): Promise<JobRow | null> {
  const { data, error } = await db
    .from("jobs")
    .select("id, status, attempts, error_text, payload, created_at, run_at")
    .eq("type", "meta:capi")
    .contains("payload", { event_name: eventName, order_ref: orderRef })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return (data as JobRow | null) ?? null;
}

async function supersedeDuplicatePurchaseJobs(
  db: ReturnType<typeof adminClient>,
  orderRef: string,
  keepJobId: string
) {
  const { data, error } = await db
    .from("jobs")
    .select("id, status")
    .eq("type", "meta:capi")
    .contains("payload", { event_name: "Purchase", order_ref: orderRef })
    .neq("id", keepJobId);
  if (error) {
    throw new Error(error.message);
  }

  const duplicateIds = (data ?? [])
    .filter((row) => row.status === "pending" || row.status === "running")
    .map((row) => row.id);
  if (duplicateIds.length === 0) return;

  const { error: updateErr } = await db
    .from("jobs")
    .update({
      status: "failed",
      error_text: `superseded_by_job:${keepJobId}`,
    })
    .in("id", duplicateIds);
  if (updateErr) {
    throw new Error(updateErr.message);
  }
}

function buildPurchasePayload(input: {
  order: OrderRow;
  paidAt: string | null;
  paymentMeta: ReturnType<typeof extractPaymentMeta> | null;
  initiatePayload: Record<string, unknown> | null;
  checkoutPayload: Record<string, unknown> | null;
  customer: CustomerRow | null;
}): CapiEventPayload | null {
  const eventTime = parseEventTimeSeconds(input.paidAt ?? input.order.created_at);
  if (eventTime === null) return null;

  return {
    event_name: "Purchase",
    event_id: `purchase_${input.order.order_ref}`,
    event_time: eventTime,
    value:
      typeof input.order.amount === "number"
        ? input.order.amount
        : Number(input.order.amount) || undefined,
    currency: input.order.currency ?? input.paymentMeta?.currency ?? "UAH",
    order_ref: input.order.order_ref,
    email: normalizeTrackingString(input.customer?.email) ?? input.paymentMeta?.email ?? null,
    phone: normalizeTrackingString(input.customer?.phone) ?? input.paymentMeta?.phone ?? null,
    fbp:
      normalizeTrackingString(input.order.fbp) ??
      payloadString(input.initiatePayload, "fbp") ??
      payloadString(input.checkoutPayload, "fbp"),
    fbc:
      payloadString(input.initiatePayload, "fbc") ??
      payloadString(input.checkoutPayload, "fbc"),
    fbclid:
      normalizeTrackingString(input.order.fbclid) ??
      payloadString(input.initiatePayload, "fbclid") ??
      payloadString(input.checkoutPayload, "fbclid"),
    ip_address:
      normalizeTrackingString(input.order.client_ip) ??
      payloadString(input.initiatePayload, "ip_address") ??
      payloadString(input.checkoutPayload, "client_ip"),
    user_agent:
      normalizeTrackingString(input.order.client_ua) ??
      payloadString(input.initiatePayload, "user_agent") ??
      payloadString(input.checkoutPayload, "client_ua") ??
      payloadString(input.checkoutPayload, "user_agent"),
    event_source_url:
      normalizeTrackingString(input.order.page_url) ??
      payloadString(input.initiatePayload, "event_source_url") ??
      payloadString(input.checkoutPayload, "page_url"),
    action_source: "website",
    content_name: normalizeTrackingString(input.order.product_code) ?? undefined,
    content_type: "product",
    content_ids: input.order.product_code ? [input.order.product_code] : undefined,
  };
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();

  const body = (await req.json().catch(() => ({}))) as BackfillBody;
  const mode = asMode(body.mode);
  if (!mode) return badRequestResponse("invalid_mode");

  const limit = asLimit(body.limit, 100, 500);
  const onlyMissing = asBoolean(body.only_missing, true);
  const range = resolveDateWindow(body.since, body.until);
  const db = adminClient();

  try {
    const paidWindowFetchLimit = Math.max(2000, limit * 20);
    const [paymentsInWindowRes, paymentEventsInWindowRes] = await Promise.all([
      db
        .from("payments")
        .select("order_ref, status, raw_payload, created_at")
        .in("status", ["paid", "completed"])
        .gte("created_at", range.fromTs)
        .lt("created_at", range.toExclusiveTs)
        .order("created_at", { ascending: false })
        .limit(paidWindowFetchLimit),
      db
        .from("events")
        .select("order_ref, payload, created_at, type")
        .in("type", ["purchase_completed", "payment_approved"])
        .gte("created_at", range.fromTs)
        .lt("created_at", range.toExclusiveTs)
        .order("created_at", { ascending: false })
        .limit(paidWindowFetchLimit),
    ]);

    if (paymentsInWindowRes.error) return serverErrorResponse(paymentsInWindowRes.error.message);
    if (paymentEventsInWindowRes.error) return serverErrorResponse(paymentEventsInWindowRes.error.message);

    const paidWindowEntries = buildPaidWindowEntries({
      payments: (paymentsInWindowRes.data ?? []) as PaymentRow[],
      paymentEvents: (paymentEventsInWindowRes.data ?? []) as (EventRow & { type?: string | null })[],
    });

    if (paidWindowEntries.length === 0) {
      return NextResponse.json({
        ok: true,
        mode,
        since: range.since,
        until: range.until,
        scanned_orders: 0,
        eligible_orders: 0,
        results: [],
        summary: {},
      });
    }

    const paidAtByOrderRef = new Map<string, string>();
    for (const entry of paidWindowEntries) {
      paidAtByOrderRef.set(entry.order_ref, entry.paid_at);
    }

    const orderRefsInWindow = paidWindowEntries.map((entry) => entry.order_ref);
    const { data: orders, error: ordersErr } = await db
      .from("orders")
      .select(
        "order_ref, product_code, amount, currency, status, customer_id, fbp, fbclid, client_ip, client_ua, page_url, created_at"
      )
      .in("status", ["paid", "completed"])
      .in("order_ref", orderRefsInWindow)
      .limit(paidWindowFetchLimit);

    if (ordersErr) return serverErrorResponse(ordersErr.message);

    const orderRows = ((orders ?? []) as OrderRow[])
      .filter((row) => paidAtByOrderRef.has(row.order_ref))
      .sort((a, b) => compareIsoDesc(paidAtByOrderRef.get(a.order_ref) ?? null, paidAtByOrderRef.get(b.order_ref) ?? null))
      .slice(0, limit);

    if (orderRows.length === 0) {
      return NextResponse.json({
        ok: true,
        mode,
        since: range.since,
        until: range.until,
        scanned_orders: 0,
        eligible_orders: 0,
        results: [],
        summary: {},
      });
    }

    const orderRefs = orderRows.map((row) => row.order_ref);
    const customerIds = Array.from(
      new Set(orderRows.map((row) => row.customer_id).filter((value): value is string => typeof value === "string" && value.length > 0))
    );

    const [paymentsRes, eventsRes, customersRes] = await Promise.all([
      db
        .from("payments")
        .select("order_ref, status, raw_payload, created_at")
        .in("order_ref", orderRefs)
        .order("created_at", { ascending: false })
        .limit(Math.max(1000, orderRefs.length * 10)),
      db
        .from("events")
        .select("order_ref, payload, created_at, type")
        .in("order_ref", orderRefs)
        .in("type", ["checkout_started", "purchase_completed", "payment_approved"])
        .order("created_at", { ascending: false })
        .limit(Math.max(1000, orderRefs.length * 10)),
      customerIds.length > 0
        ? db.from("customers").select("id, email, phone").in("id", customerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (paymentsRes.error) return serverErrorResponse(paymentsRes.error.message);
    if (eventsRes.error) return serverErrorResponse(eventsRes.error.message);
    if ("error" in customersRes && customersRes.error) return serverErrorResponse(customersRes.error.message);

    const customersById = new Map<string, CustomerRow>();
    for (const row of (customersRes.data ?? []) as CustomerRow[]) {
      customersById.set(row.id, row);
    }

    const paidPaymentByOrderRef = new Map<string, PaymentRow>();
    for (const row of (paymentsRes.data ?? []) as PaymentRow[]) {
      const orderRef = normalizeTrackingString(row.order_ref);
      if (!orderRef || paidPaymentByOrderRef.has(orderRef)) continue;
      if (row.status === "paid" || row.status === "completed") {
        paidPaymentByOrderRef.set(orderRef, row);
      }
    }

    const checkoutStartedByOrderRef = new Map<string, EventRow>();
    const paymentEventByOrderRef = new Map<string, EventRow>();
    for (const row of (eventsRes.data ?? []) as (EventRow & { type?: string | null })[]) {
      const orderRef = normalizeTrackingString(row.order_ref);
      if (!orderRef) continue;
      if (row.type === "checkout_started" && !checkoutStartedByOrderRef.has(orderRef)) {
        checkoutStartedByOrderRef.set(orderRef, row);
      }
      if ((row.type === "purchase_completed" || row.type === "payment_approved") && !paymentEventByOrderRef.has(orderRef)) {
        paymentEventByOrderRef.set(orderRef, row);
      }
    }

    const initiateCheckoutJobByOrderRef = new Map<string, JobRow | null>();
    const purchaseJobByOrderRef = new Map<string, JobRow | null>();
    await Promise.all(
      orderRefs.map(async (orderRef) => {
        const [initiateJob, purchaseJob] = await Promise.all([
          fetchLatestCapiJobByOrderRef(db, "InitiateCheckout", orderRef),
          fetchLatestCapiJobByOrderRef(db, "Purchase", orderRef),
        ]);
        initiateCheckoutJobByOrderRef.set(orderRef, initiateJob);
        purchaseJobByOrderRef.set(orderRef, purchaseJob);
      })
    );

    const candidates: PurchaseBackfillCandidate[] = [];
    for (const order of orderRows) {
      const existingJob = purchaseJobByOrderRef.get(order.order_ref) ?? null;
      const paymentRow = paidPaymentByOrderRef.get(order.order_ref) ?? null;
      const paymentMeta = paymentRow ? extractPaymentMeta(paymentRow.raw_payload) : null;
      const paymentEvent = paymentEventByOrderRef.get(order.order_ref) ?? null;
      const paidAt = paidAtByOrderRef.get(order.order_ref) ?? paymentRow?.created_at ?? paymentEvent?.created_at ?? order.created_at ?? null;
      const customer = order.customer_id ? customersById.get(order.customer_id) ?? null : null;
      const initiatePayload = initiateCheckoutJobByOrderRef.get(order.order_ref)?.payload ?? null;
      const checkoutPayload = checkoutStartedByOrderRef.get(order.order_ref)?.payload ?? null;
      const payload = buildPurchasePayload({
        order,
        paidAt,
        paymentMeta,
        initiatePayload,
        checkoutPayload,
        customer,
      });

      let diagnosis: PurchaseBackfillCandidate["diagnosis"] = "missing_job";
      if (!payload) {
        diagnosis = "missing_event_time";
      } else if (existingJob?.status === "success") {
        diagnosis = "job_success";
      } else if (existingJob?.status === "failed") {
        diagnosis = "job_failed";
      } else if (existingJob?.status === "running") {
        diagnosis = "job_running";
      } else if (existingJob?.status === "pending") {
        diagnosis = "job_pending";
      }

      if (!payload) {
        candidates.push({
          order_ref: order.order_ref,
          paid_at: paidAt,
          payload: {
            event_name: "Purchase",
            event_id: `purchase_${order.order_ref}`,
            event_time: 0,
            order_ref: order.order_ref,
            action_source: "website",
          },
          existing_job: existingJob,
          diagnosis,
        });
        continue;
      }

      if (onlyMissing && (diagnosis === "job_success" || diagnosis === "job_pending" || diagnosis === "job_running")) {
        continue;
      }

      candidates.push({
        order_ref: order.order_ref,
        paid_at: paidAt,
        payload,
        existing_job: existingJob,
        diagnosis,
      });
    }

    const results: BackfillOrderResult[] = [];
    for (const candidate of candidates) {
      const existingJob = candidate.existing_job;
      const existingAttempts = existingJob?.attempts ?? 0;

      if (candidate.diagnosis === "missing_event_time") {
        results.push({
          order_ref: candidate.order_ref,
          diagnosis: candidate.diagnosis,
          action: "invalid",
          paid_at: candidate.paid_at,
          event_id: candidate.payload.event_id,
          job_id: existingJob?.id ?? null,
          job_status: "invalid",
          attempts: existingJob?.attempts ?? null,
          error_text: "missing_event_time",
        });
        continue;
      }

      if (mode === "dry_run") {
        let action: BackfillOrderResult["action"] = "preview";
        if (candidate.diagnosis === "job_success") action = "skipped_success";
        if (candidate.diagnosis === "job_pending") action = "skipped_pending";
        if (candidate.diagnosis === "job_running") action = "skipped_running";
        results.push({
          order_ref: candidate.order_ref,
          diagnosis: candidate.diagnosis,
          action,
          paid_at: candidate.paid_at,
          event_id: candidate.payload.event_id,
          job_id: existingJob?.id ?? null,
          job_status: existingJob?.status ?? null,
          attempts: existingJob?.attempts ?? null,
          error_text: existingJob?.error_text ?? null,
        });
        continue;
      }

      if (candidate.diagnosis === "job_success") {
        results.push({
          order_ref: candidate.order_ref,
          diagnosis: candidate.diagnosis,
          action: "skipped_success",
          paid_at: candidate.paid_at,
          event_id: candidate.payload.event_id,
          job_id: existingJob?.id ?? null,
          job_status: existingJob?.status ?? null,
          attempts: existingJob?.attempts ?? null,
          error_text: existingJob?.error_text ?? null,
        });
        continue;
      }

      if (candidate.diagnosis === "job_running") {
        results.push({
          order_ref: candidate.order_ref,
          diagnosis: candidate.diagnosis,
          action: "skipped_running",
          paid_at: candidate.paid_at,
          event_id: candidate.payload.event_id,
          job_id: existingJob?.id ?? null,
          job_status: existingJob?.status ?? null,
          attempts: existingJob?.attempts ?? null,
          error_text: existingJob?.error_text ?? null,
        });
        continue;
      }

      let jobId = existingJob?.id ?? null;
      let attempts = existingAttempts;

      if (existingJob?.id) {
        const { error: updateErr } = await db
          .from("jobs")
          .update({
            payload: candidate.payload,
            status: "pending",
            attempts: 0,
            error_text: null,
            run_at: new Date().toISOString(),
          })
          .eq("id", existingJob.id);
        if (updateErr) {
          results.push({
            order_ref: candidate.order_ref,
            diagnosis: candidate.diagnosis,
            action: "send_failed",
            paid_at: candidate.paid_at,
            event_id: candidate.payload.event_id,
            job_id: existingJob.id,
            job_status: existingJob.status,
            attempts: existingAttempts,
            error_text: updateErr.message,
          });
          continue;
        }
        attempts = 0;
      } else {
        const { data: insertedJob, error: insertErr } = await db
          .from("jobs")
          .insert({
            type: "meta:capi",
            payload: candidate.payload,
            status: "pending",
          })
          .select("id, attempts, status")
          .maybeSingle();
        if (insertErr) {
          results.push({
            order_ref: candidate.order_ref,
            diagnosis: candidate.diagnosis,
            action: "send_failed",
            paid_at: candidate.paid_at,
            event_id: candidate.payload.event_id,
            job_id: null,
            job_status: null,
            attempts: null,
            error_text: insertErr.message,
          });
          continue;
        }
        jobId = insertedJob?.id ?? null;
        attempts = insertedJob?.attempts ?? 0;
      }

      if (mode === "queue") {
        results.push({
          order_ref: candidate.order_ref,
          diagnosis: candidate.diagnosis,
          action: existingJob?.id ? "requeued_failed" : "queued_new",
          paid_at: candidate.paid_at,
          event_id: candidate.payload.event_id,
          job_id: jobId,
          job_status: "pending",
          attempts,
          error_text: null,
        });
        continue;
      }

      try {
        await sendCapiEvent(candidate.payload);
        if (jobId) {
          await db
            .from("jobs")
            .update({
              status: "success",
              error_text: null,
              })
              .eq("id", jobId);
          await supersedeDuplicatePurchaseJobs(db, candidate.order_ref, jobId);
        }
        results.push({
          order_ref: candidate.order_ref,
          diagnosis: candidate.diagnosis,
          action: "sent",
          paid_at: candidate.paid_at,
          event_id: candidate.payload.event_id,
          job_id: jobId,
          job_status: "success",
          attempts,
          error_text: null,
        });
      } catch (error: unknown) {
        const errorText = getErrorMessage(error);
        if (jobId) {
          await updateJobForImmediateFailure(db, jobId, attempts, errorText);
        }
        results.push({
          order_ref: candidate.order_ref,
          diagnosis: candidate.diagnosis,
          action: "send_failed",
          paid_at: candidate.paid_at,
          event_id: candidate.payload.event_id,
          job_id: jobId,
          job_status: attempts + 1 >= 3 ? "failed" : "pending",
          attempts: attempts + 1,
          error_text: errorText,
        });
      }
    }

    const summary = results.reduce<Record<string, number>>((acc, item) => {
      acc[item.action] = (acc[item.action] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      ok: true,
      mode,
      only_missing: onlyMissing,
      since: range.since,
      until: range.until,
      scanned_orders: orderRows.length,
      eligible_orders: candidates.length,
      results,
      summary,
    });
  } catch (error: unknown) {
    return serverErrorResponse(getErrorMessage(error));
  }
}
