// src/app/api/pay/start/route.ts

import { NextRequest, NextResponse } from "next/server";
import { resolveIremLandingOffer } from "@/lib/landing/offers";
import { enforceRateLimit, tooManyRequests } from "@/lib/rateLimit";
import { loadPayableOffer } from "@/lib/platform/offers";
import {
  createPaymentInvoice,
  resolveLocaleFromRequest,
} from "@/lib/paymentStart";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const rl = await enforceRateLimit(req, { name: "pay_start", limit: 30, windowSeconds: 60 });
  if (!rl.allowed) return tooManyRequests(rl.retryAfter);

  const url = new URL(req.url);
  /* NO FALLBACK. This used to be `resolvePayableProduct`, which answered an
     unrecognised code with "short" — so a typo, a stale link or a course code
     this route did not yet understand opened a checkout for Short Reboot and
     charged for it. An unknown or unpriced code is now a 404: nothing is
     charged, and the buyer sees that this offer is not on sale rather than a
     payment page for something else. */
  const offer = await loadPayableOffer(url.searchParams.get("product"));
  if (!offer) {
    return NextResponse.json({ ok: false, error: "unknown_product" }, { status: 404 });
  }
  const product = offer.code;
  const resolvedOffer = product === "irem" ? await resolveIremLandingOffer(url.searchParams) : null;
  const format = url.searchParams.get("format"); // json | null
  const locale = resolveLocaleFromRequest(req.headers, url.searchParams);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");

  const started = await createPaymentInvoice({
    offer,
    locale,
    source: "pay_start",
    offer_id: resolvedOffer?.offerId ?? url.searchParams.get("offer_id") ?? undefined,
    amountOverride: resolvedOffer?.amount ?? null,
    host,
    payload: {
      query: Object.fromEntries(url.searchParams.entries()),
      offer: resolvedOffer
        ? {
            offer_id: resolvedOffer.offerId,
            offer_token: resolvedOffer.offerToken,
            offer_applied: resolvedOffer.offerApplied,
            offer_expired: resolvedOffer.offerExpired,
            issued_at: resolvedOffer.issuedAt,
            expires_at: resolvedOffer.expiresAt,
            recipient_key: resolvedOffer.recipientKey,
            campaign: resolvedOffer.campaign,
            channel: resolvedOffer.channel,
          }
        : null,
    },
    fbp: req.cookies.get("_fbp")?.value ?? url.searchParams.get("fbp") ?? undefined,
    fbc: req.cookies.get("_fbc")?.value ?? url.searchParams.get("fbc") ?? undefined,
    fbclid: url.searchParams.get("fbclid") ?? undefined,
    campaign: url.searchParams.get("utm_campaign") ?? undefined,
    event_id: url.searchParams.get("event_id") ?? undefined,
    client_ip:
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("cf-connecting-ip") ??
      req.headers.get("x-real-ip") ??
      undefined,
    client_ua: req.headers.get("user-agent") ?? undefined,
    page_url: req.headers.get("referer") ?? undefined,
    staff: req.cookies.get("cw_staff")?.value === "1",
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
