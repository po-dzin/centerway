// src/app/api/pay/start/route.ts

import { NextRequest, NextResponse } from "next/server";
import { resolveProduct } from "@/lib/products";
import {
  createPaymentInvoice,
  resolveLocaleFromRequest,
} from "@/lib/paymentStart";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const product = resolveProduct({
    product: url.searchParams.get("product") ?? undefined,
  });
  const format = url.searchParams.get("format"); // json | null
  const locale = resolveLocaleFromRequest(req.headers, url.searchParams);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");

  const started = await createPaymentInvoice({
    product,
    locale,
    source: "pay_start",
    host,
    payload: {
      query: Object.fromEntries(url.searchParams.entries()),
    },
  });

  if (!started.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: started.error,
        details: started.details,
        need: started.need,
        order_ref: started.order_ref,
        raw: started.raw,
      },
      { status: started.status }
    );
  }

  if (format === "json") {
    return NextResponse.json({
      ok: true,
      order_ref: started.order_ref,
      product: started.product,
      url: started.payUrl,
      paymentUrl: started.payUrl,
    });
  }

  return NextResponse.redirect(started.payUrl, 302);
}
