import { NextRequest, NextResponse } from "next/server";
import { buildReturnDestination } from "@/lib/payReturn";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizePayableProduct, productReturnUrls, type PayableProductCode } from "@/lib/products";

export const runtime = "nodejs";

type ProductCode = PayableProductCode;

function norm(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Which product this return belongs to, from the parameters alone.
 *
 * `null` when nothing recognisable came back — the caller then asks the order
 * row, which is the only other place that knows. A course out of the builder
 * cannot be recovered from the order reference: `course:my-course` is written
 * into it as `course-my-course` (a colon has no business travelling through a
 * payment provider's URLs) and a slug may contain dashes of its own, so the
 * split is ambiguous by construction. The order row is not.
 */
function productFrom(orderRef: string | null, productRaw: string | null): ProductCode | null {
  if (productRaw === "short" || productRaw === "reboot") return "short";
  const normalized = normalizePayableProduct(productRaw);
  if (normalized) return normalized;
  if (orderRef?.startsWith("irem_")) return "irem";
  if (orderRef?.startsWith("short_") || orderRef?.startsWith("reboot_")) return "short";
  return null;
}

/** The product code the order was FILED under. The last word, and the true one. */
async function productFromOrder(orderRef: string): Promise<ProductCode | null> {
  try {
    const sb = supabaseAdmin();
    const { data } = await sb
      .from("orders")
      .select("product_code")
      .eq("order_ref", orderRef)
      .maybeSingle();
    return normalizePayableProduct(data?.product_code ?? null);
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
    const j = (await req.json()) as any;
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
  const ts =
    norm(p["transactionStatus"] ?? p["status"]) ||
    norm(sp.get("transactionStatus")) ||
    norm(sp.get("status"));

  if (!ts) return null;

  const low = ts.toLowerCase();
  if (low === "approved" || low === "success" || low === "paid") return "paid";
  if (low === "declined" || low === "failed" || low === "failure") return "failed";

  return null;
}

function extractMeta(raw: any): { rrn?: string; amount?: string; currency?: string } {
  if (!raw || typeof raw !== "object") return {};
  const rrn = typeof raw.rrn === "string" ? raw.rrn : typeof raw.RRN === "string" ? raw.RRN : undefined;

  const amount =
    typeof raw.amount === "string" ? raw.amount :
    typeof raw.amount === "number" ? String(raw.amount) :
    typeof raw.orderAmount === "string" ? raw.orderAmount :
    typeof raw.orderAmount === "number" ? String(raw.orderAmount) :
    undefined;

  const currency =
    typeof raw.currency === "string" ? raw.currency :
    typeof raw.orderCurrency === "string" ? raw.orderCurrency :
    undefined;

  return { rrn, amount, currency };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// orders.status is written by the server-to-server WFP webhook, which races the browser
// return. When the return carries no status param we can read the row before the webhook
// commits `paid`; retry briefly so a real payment is not mislabelled as failed. Each read
// is guarded so a transient DB error degrades to a retry instead of a 500.
async function statusFromDb(orderRef: string): Promise<"paid" | "failed"> {
  const attempts = 4;
  const delayMs = 350;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const sb = supabaseAdmin();
      const { data: order } = await sb
        .from("orders")
        .select("status")
        .eq("order_ref", orderRef)
        .maybeSingle();
      if (order?.status === "paid") return "paid";
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
  return "failed";
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
  // Resolve product up front (no DB) so the backstop can always route to a real page.
  // "short" only as the last resort of the last resort: the catch-all below has
  // to redirect somewhere real even when the request carried nothing at all,
  // and every product's failure page is the same platform page anyway.
  let product: ProductCode = productFrom(norm(sp.get("order_ref")) || norm(sp.get("orderReference")), norm(sp.get("product"))) ?? "short";

  try {
    const body = await readBody(req);

    const orderRef =
      norm(sp.get("order_ref")) ||
      norm(sp.get("orderReference")) ||
      norm(body["order_ref"]) ||
      norm(body["orderReference"]);

    const productRaw = norm(sp.get("product")) || norm(body["product"]);
    const fromParams = productFrom(orderRef, productRaw);
    if (fromParams) product = fromParams;

    // Если order_ref не пришел — не можем понять что делать
    if (!orderRef) {
      return NextResponse.redirect(productReturnUrls(product).declinedUrl, { status: 302 });
    }

    // The parameters said nothing usable — ask the order itself before deciding
    // where to send the buyer. A wrong product here shows the wrong "open your
    // course" button to someone who has just paid.
    if (!fromParams) {
      product = (await productFromOrder(orderRef)) ?? product;
    }

    // 1) пробуем понять из параметров, 2) иначе смотрим БД (с ретраем на гонку webhook)
    const byParams = statusFromParams(body, sp);
    const finalStatus = byParams ?? (await statusFromDb(orderRef));

    // мета платежа (rrn/amount/currency) — берём из payments.raw_payload если есть
    const metaFromParams = pickMeta(body, sp);
    const metaFromDb = await latestPaymentMeta(orderRef);

    const meta = metaFromParams.rrn || metaFromParams.amount ? metaFromParams : metaFromDb;

    const destination = buildReturnDestination(
      finalStatus,
      product,
      orderRef,
      { rrn: meta.rrn ?? null, amount: meta.amount ?? null, currency: meta.currency ?? null },
      Date.now()
    );

    return NextResponse.redirect(destination, { status: 302 });
  } catch (err) {
    // Never 500 the post-payment page. Fall back to pay-failed (never thanks — we must not
    // show a success page / fire the browser Purchase without a confirmed payment).
    console.error("pay_return_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.redirect(productReturnUrls(product).declinedUrl, { status: 302 });
  }
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}
