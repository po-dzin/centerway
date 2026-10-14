// src/app/api/pay/start/route.ts

import { NextRequest, NextResponse } from "next/server";
import { IREM_OFFER_CODE, resolveIremLandingOffer } from "@/lib/landing/offers";
import { enforceRateLimit, tooManyRequests } from "@/lib/api/rateLimit";
import { loadPayableOffer } from "@/lib/platform/offers";
import { createPaymentInvoice, resolveLocaleFromRequest } from "@/lib/payments/paymentStart";
import { readAttribution } from "@/lib/referral/attribution";
import { userFromCookies } from "@/lib/auth/serverSession";
import { CHECKOUT_PAGE_PATH } from "@/lib/products";
import { normalizeCustomerEmail } from "@/lib/platform/customerIdentity";
import { AGENT_COOKIE, isAgentRequest } from "@/lib/tracking/agentTraffic";

export const runtime = "nodejs";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** A typed address in a shape worth binding an order to, normalised; else null. */
function typedBuyerEmail(raw: string | null): string | null {
  const email = normalizeCustomerEmail(raw);
  return email && email.length <= 254 && EMAIL_SHAPE.test(email) ? email : null;
}

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
  /* NO PAYMENT WITHOUT AN ADDRESS TO CREDIT (owner, 2026-10-09 and 2026-10-11).
     Access is matched by email and a gateway may not return the payer's
     address at all, so the order is bound to one BEFORE the buyer leaves.
     Two sources, in this order:
     1. `?email=` typed on the checkout page (`/pay/checkout`). It is what that
        page promised the buyer, so it is honoured even for a signed-in buyer
        (a gift). NOT verified, which the page's note says;
     2. the signed-in session — a verified address; the session cookies are
        shared across `.centerway.net.ua`, so the checkout page sends no
        address for a signed-in buyer and this reads it here.
     With neither — an old link, a bookmark, a landing still cached from before
     the checkout page — a browser is sent to that page with the same query,
     and `format=json` callers get a 401 naming it. */
  const typedEmail = typedBuyerEmail(url.searchParams.get("email"));
  const user = typedEmail ? null : await userFromCookies();
  const sessionEmail = user?.email_confirmed_at ? user.email?.trim().toLowerCase() || null : null;
  const buyerEmail = typedEmail ?? sessionEmail;
  if (!buyerEmail) {
    const checkout = new URL(CHECKOUT_PAGE_PATH, req.url);
    url.searchParams.forEach((value, key) => {
      if (key !== "email") checkout.searchParams.append(key, value);
    });
    if (url.searchParams.get("format") === "json") {
      checkout.searchParams.delete("format");
      return NextResponse.json(
        { ok: false, error: "address_required", checkoutUrl: checkout.toString() },
        { status: 401 },
      );
    }
    return NextResponse.redirect(checkout, 302);
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
