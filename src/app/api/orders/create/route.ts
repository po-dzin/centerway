// src/app/api/orders/create/route.ts

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadPayableOffer } from "@/lib/platform/offers";
import { makeOrderRef } from "@/lib/paymentStart";
import { enforceRateLimit, tooManyRequests } from "@/lib/rateLimit";
import type { CapiEventPayload } from "@/lib/tracking/capi";

export const runtime = "nodejs";

type Body = {
  product_code?: unknown; // может прилететь что угодно
  // optional attribution payload for CAPI matching quality
  attrib?: {
    fbp?: unknown;
    fbc?: unknown;
    fbclid?: unknown;
    utm_campaign?: unknown;
    event_id?: unknown;
    page_url?: unknown;
    client_ip?: unknown;
    client_ua?: unknown;
  } | null;
};

function asOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * This route writes a row that the entitlement later reads, so it answers to
 * CenterWay pages only. It used to answer `Access-Control-Allow-Origin: *`,
 * which let any page on the web file orders against our catalogue.
 */
const ALLOWED_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*centerway\.net\.ua$/;

function allowedOrigin(req: NextRequest): string | null {
  const origin = req.headers.get("origin");
  if (!origin) return null; // same-origin and server-side callers send no Origin
  if (ALLOWED_ORIGIN.test(origin)) return origin;
  if (process.env.NODE_ENV !== "production" && /^http:\/\/localhost(:\d+)?$/.test(origin)) {
    return origin;
  }
  return null;
}

function cors(res: NextResponse, origin: string | null) {
  // Vary matters even when nothing is allowed: the answer depends on Origin,
  // and a shared cache must not hand one site's response to another.
  res.headers.set("Vary", "Origin");
  if (origin) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  }
  return res;
}

export async function OPTIONS(req: NextRequest) {
  return cors(new NextResponse(null, { status: 204 }), allowedOrigin(req));
}

function newOrderRef(product: Parameters<typeof makeOrderRef>[0]) {
  return makeOrderRef(product, () => Date.now(), (bytes) => crypto.randomBytes(bytes).toString("hex"));
}

export async function POST(req: NextRequest) {
  const origin = allowedOrigin(req);

  const rl = await enforceRateLimit(req, { name: "orders_create", limit: 30, windowSeconds: 60 });
  if (!rl.allowed) return cors(tooManyRequests(rl.retryAfter), origin);

  try {
    const body = (await req.json()) as Body;

    /* Same rule as /api/pay/start: no fallback product. This route only
       RECORDS an order, but the row it writes is what the entitlement later
       reads, so an order filed under the wrong code is access to the wrong
       course. */
    const cfg = await loadPayableOffer(body.product_code);
    if (!cfg) {
      return cors(NextResponse.json({ ok: false, error: "unknown_product" }, { status: 404 }), origin);
    }
    const product = cfg.code;
    const attrib = body.attrib ?? null;

    const order_ref = newOrderRef(product);

    const sb = supabaseAdmin();

    // ВСТАВЛЯЕМ ТОЛЬКО ТО, ЧТО ТОЧНО ЕСТЬ В orders (по твоим скринам)
    const { error } = await sb.from("orders").insert({
      order_ref,
      product_code: product,
      amount: cfg.amount,
      currency: cfg.currency,
      status: "created",
      fbp: asOptionalString(attrib?.fbp),
      fbclid: asOptionalString(attrib?.fbclid),
      campaign: asOptionalString(attrib?.utm_campaign),
      client_ip: asOptionalString(attrib?.client_ip),
      client_ua: asOptionalString(attrib?.client_ua),
      page_url: asOptionalString(attrib?.page_url),
    });

    if (error) {
      return cors(
        NextResponse.json(
          { ok: false, error: "db_order_insert_failed", details: error.message },
          { status: 500 }
        ),
        origin
      );
    }

    const clientEventId = asOptionalString(attrib?.event_id);
    const capiEventId = clientEventId ?? `checkout_${order_ref}`;
    const [existingByEventIdRes, existingByOrderRefRes] = await Promise.all([
      sb
        .from("jobs")
        .select("id")
        .eq("type", "meta:capi")
        .contains("payload", { event_name: "InitiateCheckout", event_id: capiEventId })
        .limit(1)
        .maybeSingle(),
      sb
        .from("jobs")
        .select("id")
        .eq("type", "meta:capi")
        .contains("payload", { event_name: "InitiateCheckout", order_ref: order_ref })
        .limit(1)
        .maybeSingle(),
    ]);

    const hasExistingInitiateCheckoutJob =
      Boolean(existingByEventIdRes.data?.id) || Boolean(existingByOrderRefRes.data?.id);

    // Always ensure a server-side InitiateCheckout CAPI job exists for each created order.
    // Use event_id dedupe key to stay compatible with client-side Pixel/CAPI deduplication.
    if (!hasExistingInitiateCheckoutJob) {
      const capiPayload: CapiEventPayload = {
        event_name: "InitiateCheckout",
        event_id: capiEventId,
        event_time: Math.floor(Date.now() / 1000),
        value: cfg.amount,
        currency: cfg.currency,
        order_ref,
        fbp: asOptionalString(attrib?.fbp),
        fbc: asOptionalString(attrib?.fbc),
        fbclid: asOptionalString(attrib?.fbclid),
        ip_address: asOptionalString(attrib?.client_ip),
        user_agent: asOptionalString(attrib?.client_ua),
        event_source_url: asOptionalString(attrib?.page_url),
        action_source: "website",
        // The agreed reporting label, not the raw code — same signal the browser
        // Pixel and the Purchase job send, so one product is one name in Meta.
        content_name: cfg.pixelContentName,
        content_type: "product",
        content_ids: [product],
      };
      await sb.from("jobs").insert({
        type: "meta:capi",
        payload: capiPayload,
        status: "pending",
      });
    }

    return cors(
      NextResponse.json({
        ok: true,
        order_ref,
        product,
        amount: cfg.amount,
        currency: cfg.currency,
        status: "created",
      }),
      origin
    );
  } catch (e: any) {
    return cors(
      NextResponse.json(
        { ok: false, error: "bad_request", details: String(e?.message ?? e) },
        { status: 400 }
      ),
      origin
    );
  }
}
