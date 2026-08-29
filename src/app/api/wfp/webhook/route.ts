import { NextRequest, NextResponse } from "next/server";
import { sendConfirmedSaleTelegramReport } from "@/lib/reporting/analyticsReports";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { extractPaymentMeta } from "@/lib/paymentMeta";
import {
  buildWfpAcceptResponse,
  isWfpApproved,
  verifyWfpCallbackSignature,
  wfpEventTypeFromStatus,
  type WfpSignatureCheck,
} from "@/lib/wfp";
import { dispatchCapiEventInline } from "@/lib/tracking/capiDispatch";
import { isStaffOrder } from "@/lib/tracking/staffOrders";
import {
  buildPurchaseCapiEventPayload,
  type PendingPurchaseCapiJobPayload,
} from "@/lib/jobs/worker";

export const runtime = "nodejs";

type Payload = Record<string, string>;

async function readBodyParams(req: NextRequest): Promise<Payload> {
  // JSON
  try {
    const j = (await req.json()) as unknown;
    if (j && typeof j === "object") {
      const out: Payload = {};
      for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          out[k] = String(v);
        }
      }
      return out;
    }
  } catch { }

  // form-data (WFP иногда шлёт form-url-encoded)
  try {
    const fd = await req.formData();
    const out: Payload = {};
    for (const [k, v] of fd.entries()) out[k] = String(v);
    return out;
  } catch { }

  return {};
}

function norm(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function normEmail(email: string | null): string | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  return e ? e : null;
}

function normPhone(phone: string | null): string | null {
  if (!phone) return null;
  const p = phone.trim();
  return p ? p : null;
}

function parseUnixSeconds(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 1_000_000_000_000) return Math.floor(value / 1000);
    if (value > 1_000_000_000) return Math.floor(value);
    return null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric)) return null;
    if (numeric > 1_000_000_000_000) return Math.floor(numeric / 1000);
    if (numeric > 1_000_000_000) return Math.floor(numeric);
  }

  const parsedMs = Date.parse(trimmed);
  if (!Number.isFinite(parsedMs)) return null;
  return Math.floor(parsedMs / 1000);
}

function resolvePaymentEventTime(payload: Payload): number {
  const candidates = [
    payload["transactionDate"],
    payload["transaction_date"],
    payload["paymentDate"],
    payload["payment_date"],
    payload["processingDate"],
    payload["processing_date"],
    payload["updatedDate"],
    payload["updated_at"],
    payload["createdDate"],
    payload["created_at"],
  ];

  for (const candidate of candidates) {
    const parsed = parseUnixSeconds(candidate);
    if (parsed !== null) return parsed;
  }

  return Math.floor(Date.now() / 1000);
}

async function upsertCustomer(
  sb: ReturnType<typeof supabaseAdmin>,
  email: string | null,
  phone: string | null
): Promise<string | null> {
  const e = normEmail(email);
  const p = normPhone(phone);
  if (!e && !p) return null;

  // 1) find by both keys (if present), prefer earliest created record.
  const candidates: Array<{ id: string; created_at: string | null }> = [];

  if (e) {
    const { data, error } = await sb
      .from("customers")
      .select("id,created_at")
      .eq("email", e)
      .order("created_at", { ascending: true })
      .limit(1);
    if (!error && data?.[0]?.id) {
      candidates.push({
        id: data[0].id,
        created_at: typeof data[0].created_at === "string" ? data[0].created_at : null,
      });
    }
  }

  if (p) {
    const { data, error } = await sb
      .from("customers")
      .select("id,created_at")
      .eq("phone", p)
      .order("created_at", { ascending: true })
      .limit(1);
    if (!error && data?.[0]?.id) {
      candidates.push({
        id: data[0].id,
        created_at: typeof data[0].created_at === "string" ? data[0].created_at : null,
      });
    }
  }

  const foundId =
    candidates
      .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
      .map((x) => x.id)[0] ?? null;
  if (foundId) {
    const { error } = await sb.from("customers").update({ email: e, phone: p }).eq("id", foundId);
    if (error) throw error;
    return foundId;
  }

  const { error } = await sb.from("customers").insert({ email: e, phone: p });
  if (error) {
    // In race conditions with unique indexes, another request may create the same customer first.
    const code = (error as { code?: string }).code;
    if (code !== "23505") throw error;
  }

  // fetch id of the just-created customer
  if (e) {
    const { data } = await sb
      .from("customers")
      .select("id")
      .eq("email", e)
      .order("created_at", { ascending: true })
      .limit(1);
    if (data?.[0]?.id) return data[0].id;
  }
  if (p) {
    const { data } = await sb
      .from("customers")
      .select("id")
      .eq("phone", p)
      .order("created_at", { ascending: true })
      .limit(1);
    if (data?.[0]?.id) return data[0].id;
  }
  return null;
}

async function enqueueTelegramSaleReport(
  sb: ReturnType<typeof supabaseAdmin>,
  orderRef: string
): Promise<void> {
  const { data: existingTelegramJob } = await sb
    .from("jobs")
    .select("id")
    .eq("type", "reporting:telegram-sale")
    .contains("payload", { order_ref: orderRef })
    .limit(1)
    .maybeSingle();

  if (existingTelegramJob?.id) return;

  const { error: reportJobErr } = await sb.from("jobs").insert({
    type: "reporting:telegram-sale",
    payload: { order_ref: orderRef },
    status: "pending",
  });

  if (reportJobErr) {
    throw reportJobErr;
  }
}

export async function POST(req: NextRequest) {
  const payload = await readBodyParams(req);

  const orderRef = norm(payload["orderReference"] ?? payload["order_ref"]);
  if (!orderRef) {
    return NextResponse.json({ ok: false, error: "missing_order_ref" }, { status: 400 });
  }

  const paid = isWfpApproved(payload);
  const status = paid ? "paid" : "created"; // твоя бинарная модель
  const eventType = wfpEventTypeFromStatus(payload);

  // The signature is the gate, and it stands before every write below: an unsigned or
  // wrongly-signed callback must not reach `payments`, must not flip `orders.status`,
  // and must not enqueue a Purchase. Anyone can POST here, so without this check a
  // forged `orderReference` bought free access and sent Meta a sale that never happened.
  let sig: WfpSignatureCheck;
  try {
    sig = verifyWfpCallbackSignature(payload);
  } catch (sigErr) {
    console.error("[wfp-sig] verification errored", {
      orderRef,
      error: sigErr instanceof Error ? sigErr.message : String(sigErr),
    });
    return NextResponse.json({ ok: false, error: "signature_check_failed" }, { status: 500 });
  }

  if (!sig.ok) {
    // Logged, never stored: this endpoint is unauthenticated, so writing a row per
    // rejected call would hand an attacker a way to fill the database.
    console.warn("[wfp-sig] rejected callback", { orderRef, reason: sig.reason, present: sig.present });
    const httpStatus = sig.reason === "missing_secret" ? 500 : 403;
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: httpStatus });
  }

  const sb = supabaseAdmin();

  // мета из payload: rrn/email/phone/amount/currency и т.д.
  const meta = extractPaymentMeta(payload);
  const providerTxId =
    norm(meta.rrn) ??
    norm(payload["rrn"]) ??
    norm(payload["transactionId"]) ??
    norm(payload["payment_id"]) ??
    norm(payload["id"]);
  const safeProviderTxId = providerTxId ?? `order:${orderRef}`;

  try {
    // 1) payments: сохраняем как источник правды
    // ⚠️ provider обязателен (у тебя NOT NULL) — ставим явно
    // ⚠️ raw_payload NOT NULL — кладём payload
    const { error: pErr } = await sb.from("payments").insert({
      provider: "wfp",
      order_ref: orderRef,
      provider_tx_id: safeProviderTxId,
      status,
      raw_payload: payload,
    });

    // 2) orders.status
    const { data: order, error: oGetErr } = await sb
      .from("orders")
      .select("customer_id, product_code")
      .eq("order_ref", orderRef)
      .maybeSingle();

    const { error: oErr } = await sb
      .from("orders")
      .update({
        status,
        customer_id: order?.customer_id ?? null,
      })
      .eq("order_ref", orderRef);

    // 3) customers: материализуем email/phone из платежа
    const errors: string[] = [];

    if (pErr) {
      const code = (pErr as any)?.code;
      if (code !== "23505") {
        errors.push(`payments: ${pErr.message ?? "unknown"}`);
      }
    }

    if (oGetErr) {
      errors.push(`orders_get: ${oGetErr.message ?? "unknown"}`);
    }

    if (oErr) {
      errors.push(`orders: ${oErr.message ?? "unknown"}`);
    }

    try {
      const customerId = await upsertCustomer(sb, meta.email ?? null, meta.phone ?? null);
      if (customerId && !order?.customer_id) {
        const { error: ocErr } = await sb
          .from("orders")
          .update({ customer_id: customerId })
          .eq("order_ref", orderRef)
          .is("customer_id", null);
        if (ocErr) errors.push(`orders_customer: ${ocErr.message ?? "unknown"}`);
      }

      if (eventType) {
        const { data: existing } = await sb
          .from("events")
          .select("id")
          .eq("order_ref", orderRef)
          .eq("type", eventType)
          .contains("payload", { provider_tx_id: safeProviderTxId, status });

        if (!existing || existing.length === 0) {
          const { error: eErr } = await sb.from("events").insert({
            type: eventType,
            order_ref: orderRef,
            customer_id: order?.customer_id ?? customerId ?? null,
            payload: {
              status,
              provider: "wfp",
              provider_tx_id: safeProviderTxId,
              amount: meta.amount ?? null,
              currency: meta.currency ?? null,
              product_code: order?.product_code ?? null,
              raw_status: norm(payload["transactionStatus"] ?? payload["status"]) ?? null,
            },
          });
          if (eErr) errors.push(`events: ${eErr.message ?? "unknown"}`);
        }
      }
    } catch (e: any) {
      errors.push(`customers: ${String(e?.message || e)}`);
    }

    if (errors.length) {
      // WITHHOLD the acceptance. This is the branch where money moved and our
      // database did not record it, and it used to answer 200 in the belief
      // that this stopped the gateway retrying. It never did: WayForPay decides
      // from the signed `accept` body, not the status (see buildWfpAcceptResponse).
      //
      // So the correct behaviour was always available and simply unused — do
      // not accept, and WayForPay redelivers this callback for up to four days.
      // The writes below it are all idempotent, so a redelivery that succeeds
      // completes the order exactly once.
      console.error("wfp_webhook_write_failed", { orderRef, errors });
      return NextResponse.json(
        { ok: false, error: "db_write_failed", details: errors.join("; ") },
        { status: 500 }
      );
    }

    // A QA payment made with `cw_staff=1` is a real order and a real WayForPay
    // callback; only Meta must not hear about it. The flag lived in the browser,
    // which this request does not have — `/api/pay/start` left the mark for us.
    const staffOrder = paid ? await isStaffOrder(sb, orderRef) : false;
    if (staffOrder) {
      console.log("[wfp webhook] staff order, no Meta Purchase", { orderRef });
    }

    // Paid webhook work stays on the queue.
    // The request path only persists the payment signal and enqueues follow-up delivery.
    if (paid && !staffOrder) {
      try {
        const { data: existingPurchaseJob } = await sb
          .from("jobs")
          .select("id")
          .eq("type", "meta:capi")
          .contains("payload", { event_name: "Purchase", order_ref: orderRef })
          .limit(1)
          .maybeSingle();
        if (!existingPurchaseJob?.id) {
          const amountNumber =
            meta.amount != null && Number.isFinite(Number(meta.amount))
              ? Number(meta.amount)
              : undefined;
          const capiPayload: PendingPurchaseCapiJobPayload = {
            event_name: "Purchase",
            order_ref: orderRef,
            payment_event_time: resolvePaymentEventTime(payload),
            value: amountNumber,
            currency: meta.currency ?? "UAH",
            email: meta.email ?? null,
            phone: meta.phone ?? null,
          };

          const { data: purchaseJob, error: purchaseJobInsertErr } = await sb
            .from("jobs")
            .insert({
              type: "meta:capi",
              payload: capiPayload,
              status: "pending",
            })
            .select("id")
            .maybeSingle();

          if (purchaseJobInsertErr) {
            throw purchaseJobInsertErr;
          }

          // Send Purchase to Meta immediately (in sync with the browser Pixel on `thanks`)
          // instead of waiting for the daily cron. The thin job row stays the durable
          // fallback; the enriched payload is built lazily off the request path.
          if (purchaseJob?.id) {
            dispatchCapiEventInline(sb, purchaseJob.id, () =>
              buildPurchaseCapiEventPayload(capiPayload)
            );
          }
        }
      } catch (capiErr) {
        // Non-fatal: don't fail the webhook for CAPI errors
        console.warn("[wfp webhook] Failed to queue CAPI job:", capiErr);
      }
    }

    // The sale report is not analytics — the operator wants to see a QA payment
    // land too, so it is deliberately outside the staff guard above.
    if (paid) {
      try {
        await sendConfirmedSaleTelegramReport(orderRef);
      } catch (telegramErr) {
        console.warn("[wfp webhook] Failed to send Telegram sale report directly:", {
          orderRef,
          error: telegramErr instanceof Error ? telegramErr.message : String(telegramErr),
        });
        try {
          await enqueueTelegramSaleReport(sb, orderRef);
        } catch (queueReportErr) {
          console.warn("[wfp webhook] Failed to queue Telegram sale report fallback:", {
            orderRef,
            error: queueReportErr instanceof Error ? queueReportErr.message : String(queueReportErr),
          });
        }
      }
    }

    // The gateway's stop signal. Without this exact signed body it keeps
    // redelivering for four days — which is what it has been doing all along.
    const accept = buildWfpAcceptResponse(orderRef);
    if (!accept) {
      // Unreachable in practice: the signature gate above already refused the
      // request when the secret is missing. Kept because "cannot sign" must
      // never silently become "accepted".
      console.error("[wfp webhook] cannot sign acceptance, secret missing", { orderRef });
      return NextResponse.json({ ok: false, error: "missing_secret" }, { status: 500 });
    }
    return NextResponse.json(accept);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "webhook_failed", details: String(e?.message || e) }, { status: 500 });
  }
}
