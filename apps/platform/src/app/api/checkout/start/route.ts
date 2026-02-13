import { NextRequest, NextResponse } from "next/server";
import { buildCheckoutEventPayload, checkoutLeadId, CheckoutStartRequest, resolveCheckoutProduct } from "@/lib/checkout";
import { buildLeadRecord, persistLeadBestEffort } from "@/lib/checkoutFlow";
import { createPaymentInvoice, resolveLocaleFromRequest } from "@/lib/paymentStart";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function cors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return res;
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export async function POST(req: NextRequest) {
  let body: CheckoutStartRequest;
  try {
    body = (await req.json()) as CheckoutStartRequest;
  } catch (e: unknown) {
    return cors(
      NextResponse.json(
        { ok: false, error: "bad_request", details: String((e as Error)?.message ?? e) },
        { status: 400 }
      )
    );
  }

  const product = resolveCheckoutProduct(body);
  const url = new URL(req.url);
  const locale = resolveLocaleFromRequest(req.headers, url.searchParams);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");

  const started = await createPaymentInvoice({
    product,
    locale,
    source: "checkout_start",
    host,
    payload: {
      ...buildCheckoutEventPayload(body),
      subdomain: host,
    },
  });

  if (!started.ok) {
    return cors(
      NextResponse.json(
        {
          ok: false,
          error: started.error,
          details: started.details,
          need: started.need,
          order_ref: started.order_ref,
          raw: started.raw,
        },
        { status: started.status }
      )
    );
  }

  // Separate lead list (non-blocking for payment).
  const leadWrite = await persistLeadBestEffort(
    supabaseAdmin(),
    buildLeadRecord(body, started.product, started.order_ref, host)
  );

  return cors(
    NextResponse.json({
      ok: true,
      paymentUrl: started.payUrl,
      order_ref: started.order_ref,
      product: started.product,
      lead_id: checkoutLeadId(started.order_ref),
      lead_saved: leadWrite,
    })
  );
}
