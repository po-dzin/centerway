import { NextRequest, NextResponse } from "next/server";
import { buildReturnDestination, resolveReturnStatus } from "@/lib/payments/payReturn";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { describeOffer, type OfferTarget } from "@/lib/experiences/offers";
import { storedCallbackOutcome } from "@/lib/payments/gateway";
import type { PaymentOutcome } from "@/lib/payments/orderStatus";
import { PLATFORM_FAILED_URL } from "@/lib/products";

export const runtime = "nodejs";

function norm(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * What was bought, through the one channel from a code to an offer.
 *
 * The code on the return is tried first, then the code the order was FILED
 * under, which is the last word. Either may be any spelling the offer ever had
 * (`reboot`, `way21`, `way21-group`, `course:way21`): `describeOffer` answers
 * through `offer_aliases`, so this route keeps no table of its own. The old
 * `irem_` / `short_` order-reference prefixes are not read any more — the order
 * row says the same thing without guessing.
 *
 * `null` when neither resolves; the buyer then returns to the generic pages,
 * which are where every product returns on failure anyway.
 */
async function offerFor(codeFromParams: string | null, orderRef: string): Promise<OfferTarget | null> {
  try {
    const sb = supabaseAdmin();
    if (codeFromParams) {
      const fromParams = await describeOffer(sb, codeFromParams);
      if (fromParams) return fromParams;
    }
    const { data } = await sb.from("orders").select("product_code").eq("order_ref", orderRef).maybeSingle();
    return data?.product_code ? await describeOffer(sb, data.product_code) : null;
  } catch (err) {
    console.warn("pay_return_product_read_failed", {
      orderRef,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function readBody(req: NextRequest): Promise<Record<string, string>> {
  // JSON
  try {
    const j = (await req.json()) as unknown;
    if (j && typeof j === "object") {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(j)) {
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          out[k] = String(v);
        }
      }
      return out;
    }
  } catch {}

  // form-data / x-www-form-urlencoded
  try {
    const fd = await req.formData();
    const out: Record<string, string> = {};
    for (const [k, v] of fd.entries()) out[k] = String(v);
    return out;
  } catch {}

  return {};
}

function statusFromParams(p: Record<string, string>, sp: URLSearchParams): "paid" | "failed" | null {
  const ts = norm(p["transactionStatus"] ?? p["status"]) || norm(sp.get("transactionStatus")) || norm(sp.get("status"));

  if (!ts) return null;

  const low = ts.toLowerCase();
  if (low === "approved" || low === "success" || low === "paid") return "paid";
  if (low === "declined" || low === "failed" || low === "failure") return "failed";

  return null;
}

function extractMeta(raw: unknown): { rrn?: string; amount?: string; currency?: string } {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const rrn = typeof r.rrn === "string" ? r.rrn : typeof r.RRN === "string" ? r.RRN : undefined;

  const amount =
    typeof r.amount === "string"
      ? r.amount
      : typeof r.amount === "number"
        ? String(r.amount)
        : typeof r.orderAmount === "string"
          ? r.orderAmount
          : typeof r.orderAmount === "number"
            ? String(r.orderAmount)
            : undefined;

  const currency =
    typeof r.currency === "string" ? r.currency : typeof r.orderCurrency === "string" ? r.orderCurrency : undefined;

  return { rrn, amount, currency };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * What the database knows about this payment right now.
 *
 * `orders.status` is written by the server-to-server callback, which races the
 * browser's return, so a short retry is still worth it — most callbacks land
 * within the second and waiting spares the buyer a pending screen they did not
 * need to see.
 *
 * What changed is what happens when the retries run out. This used to return
 * `failed`, turning "we have not heard yet" into "your payment was declined";
 * it now reports the evidence and lets `resolveReturnStatus` decide. The last
 * stored callback is read alongside, because a callback that ARRIVED and said
 * Declined is the one thing that distinguishes a real failure from silence.
 */
async function paymentEvidence(
  orderRef: string,
): Promise<{ orderStatus: string | null; lastCallbackOutcome: PaymentOutcome | null }> {
  const attempts = 4;
  const delayMs = 350;
  let orderStatus: string | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const sb = supabaseAdmin();
      const { data: order } = await sb.from("orders").select("status").eq("order_ref", orderRef).maybeSingle();
      orderStatus = (order?.status as string | null) ?? orderStatus;
      if (orderStatus === "paid" || orderStatus === "refunded") {
        return { orderStatus, lastCallbackOutcome: null };
      }
    } catch (err) {
      console.warn("pay_return_status_read_failed", {
        orderRef,
        attempt,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    if (attempt < attempts - 1) {
      await sleep(delayMs);
    }
  }

  return { orderStatus, lastCallbackOutcome: await lastCallbackOutcome(orderRef) };
}

/** What the most recent stored callback for this order said, in its gateway's words. */
async function lastCallbackOutcome(orderRef: string): Promise<PaymentOutcome | null> {
  try {
    const sb = supabaseAdmin();
    const { data } = await sb
      .from("payments")
      .select("provider, raw_payload")
      .eq("order_ref", orderRef)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return storedCallbackOutcome(data);
  } catch (err) {
    console.warn("pay_return_callback_read_failed", {
      orderRef,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function latestPaymentMeta(orderRef: string) {
  try {
    const sb = supabaseAdmin();
    const { data } = await sb
      .from("payments")
      .select("raw_payload, created_at")
      .eq("order_ref", orderRef)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return extractMeta(data?.raw_payload);
  } catch (err) {
    console.warn("pay_return_meta_read_failed", {
      orderRef,
      error: err instanceof Error ? err.message : String(err),
    });
    return {};
  }
}

function pickMeta(body: Record<string, string>, sp: URLSearchParams) {
  const rrn = body.rrn || sp.get("rrn") || body.payment_id || sp.get("payment_id") || "";
  const amount = body.amount || sp.get("amount") || "";
  const currency = body.currency || sp.get("currency") || "";
  return { rrn: rrn || null, amount: amount || null, currency: currency || null };
}

async function handler(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  try {
    const body = await readBody(req);

    const orderRef =
      norm(sp.get("order_ref")) ||
      norm(sp.get("orderReference")) ||
      norm(body["order_ref"]) ||
      norm(body["orderReference"]);

    // Если order_ref не пришел — не можем понять что делать
    if (!orderRef) {
      return NextResponse.redirect(PLATFORM_FAILED_URL, { status: 302 });
    }

    // A wrong product here shows the wrong "open your course" button to
    // someone who has just paid, so it is resolved before anything else.
    const productRaw = norm(sp.get("product")) || norm(body["product"]);
    const target = await offerFor(productRaw, orderRef);
    const product = target?.offer.code ?? productRaw ?? "";

    // 1) what the gateway told the browser, 2) otherwise what the database can
    // prove. Never a timeout: see `resolveReturnStatus`.
    const byParams = statusFromParams(body, sp);
    const evidence = byParams ? null : await paymentEvidence(orderRef);
    const finalStatus = resolveReturnStatus({
      fromParams: byParams,
      orderStatus: evidence?.orderStatus ?? null,
      lastCallbackOutcome: evidence?.lastCallbackOutcome ?? null,
    });

    // мета платежа (rrn/amount/currency) — берём из payments.raw_payload если есть
    const metaFromParams = pickMeta(body, sp);
    const metaFromDb = await latestPaymentMeta(orderRef);

    const meta = metaFromParams.rrn || metaFromParams.amount ? metaFromParams : metaFromDb;

    const destination = buildReturnDestination(
      finalStatus,
      product,
      orderRef,
      { rrn: meta.rrn ?? null, amount: meta.amount ?? null, currency: meta.currency ?? null },
      Date.now(),
      target?.course ? `/programs/${target.course.programSlug}` : null,
    );

    return NextResponse.redirect(destination, { status: 302 });
  } catch (err) {
    // Never 500 the post-payment page. Fall back to pay-failed (never thanks — we must not
    // show a success page / fire the browser Purchase without a confirmed payment).
    console.error("pay_return_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.redirect(PLATFORM_FAILED_URL, { status: 302 });
  }
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}
