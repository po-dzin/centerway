// src/app/api/pay/start/route.ts

import { NextRequest, NextResponse } from "next/server";
import { IREM_OFFER_CODE, resolveIremLandingOffer } from "@/lib/landing/offers";
import { enforceRateLimit, tooManyRequests } from "@/lib/api/rateLimit";
import { loadPayableOffer } from "@/lib/platform/offers";
import { createPaymentInvoice, resolveLocaleFromRequest } from "@/lib/payments/paymentStart";
import { readAttribution } from "@/lib/referral/attribution";
import { userFromCookies } from "@/lib/auth/serverSession";
import { personalUrl } from "@/lib/surfaces/catalog";
import { AGENT_COOKIE, isAgentRequest } from "@/lib/tracking/agentTraffic";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const rl = await enforceRateLimit(req, { name: "pay_start", limit: 30, windowSeconds: 60 });
  if (!rl.allowed) return tooManyRequests(rl.retryAfter);

  const url = new URL(req.url);
  const attribution = readAttribution(req);
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
  /* NO PAYMENT WITHOUT AN ACCOUNT (owner's decision, 2026-10-09, «Везде»).
     Access is matched by email and a gateway may not return the payer's address
     at all, so the buyer signs in FIRST and the order is bound to the verified
     account before they leave for the gateway. A browser navigation is sent to
     the email door and comes back to this very address; `format=json` callers
     get a 401 naming the door. The session cookies are shared across
     `.centerway.net.ua`, so this works from the landings too. */
  const user = await userFromCookies();
  const buyerEmail = user?.email?.trim().toLowerCase() || null;
  if (!user || !buyerEmail || !user.email_confirmed_at) {
    const signInUrl = personalUrl(`/signin/email?next=${encodeURIComponent(req.url)}`);
    if (url.searchParams.get("format") === "json") {
      return NextResponse.json({ ok: false, error: "sign_in_required", signInUrl }, { status: 401 });
    }
    return NextResponse.redirect(signInUrl, 302);
  }
  const product = offer.code;
  const resolvedOffer = product === IREM_OFFER_CODE ? await resolveIremLandingOffer(url.searchParams) : null;
  const format = url.searchParams.get("format"); // json | null
  const locale = resolveLocaleFromRequest(req.headers, url.searchParams);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  /* A blank `x-forwarded-for` trims to `""`, which `??` treats as an answer.
     The invoice then carried an empty client_ip to Meta instead of falling
     through to `cf-connecting-ip`. Empty has to fall through. */
  const forwardedIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

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
    // The pay link on a platform page carries no UTM of its own; the landing
    // that did is remembered by the proxy (`lib/referral/attribution`).
    campaign: url.searchParams.get("utm_campaign") ?? attribution.utm?.campaign ?? undefined,
    ref: attribution.ref,
    event_id: url.searchParams.get("event_id") ?? undefined,
    client_ip:
      (forwardedIp || null) ?? req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? undefined,
    client_ua: req.headers.get("user-agent") ?? undefined,
    page_url: req.headers.get("referer") ?? undefined,
    buyer: { email: buyerEmail },
    staff: req.cookies.get("cw_staff")?.value === "1",
    agent: isAgentRequest(req.headers, req.cookies.get(AGENT_COOKIE)?.value),
  });

  if (!started.ok) {
    // The gateway's own answer stays in the log. It used to be sent to the
    // buyer's browser as `raw`, on a page the buyer opens by clicking "pay".
    if (started.raw) console.error("[pay/start] invoice failed", { order_ref: started.order_ref, raw: started.raw });
    return NextResponse.json(
      {
        ok: false,
        error: started.error,
        details: started.details,
        need: started.need,
        order_ref: started.order_ref,
      },
      { status: started.status },
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
