import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { persistLeadBestEffort, type LeadRecord } from "@/lib/checkoutFlow";
import { normalizeProduct, type ProductCode } from "@/lib/products";
import { enforceRateLimit, tooManyRequests } from "@/lib/rateLimit";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type LeadRequestBody = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  product_code?: unknown;
  product?: unknown;
  source?: unknown;
  page_url?: unknown;
  referrer?: unknown;
  message?: unknown;
  interest?: unknown;
  cta_place?: unknown;
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
  utm_content?: unknown;
  utm_term?: unknown;
  fbp?: unknown;
  fbc?: unknown;
  fbclid?: unknown;
  event_id?: unknown;
};

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s || null;
}

function cors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return res;
}

function makeLeadRef(product: ProductCode): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `lead_${product}_${y}${m}${day}_${crypto.randomBytes(4).toString("hex")}`;
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, { name: "leads", limit: 15, windowSeconds: 60 });
  if (!rl.allowed) return cors(tooManyRequests(rl.retryAfter));

  const body = (await req.json().catch(() => ({}))) as LeadRequestBody;
  const name = asString(body.name);
  const phone = asString(body.phone);
  const email = asString(body.email)?.toLowerCase() ?? null;
  const product = normalizeProduct({
    product: asString(body.product) ?? undefined,
    product_code: asString(body.product_code) ?? undefined,
  }) ?? "consult";

  if (!name || (!phone && !email)) {
    return cors(
      NextResponse.json(
        { ok: false, error: "contact_required" },
        { status: 400 }
      )
    );
  }

  const pageUrl = asString(body.page_url) ?? req.headers.get("referer") ?? null;
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    null;
  const lead: LeadRecord = {
    order_ref: makeLeadRef(product),
    product_code: product,
    source: asString(body.source) ?? "platform_consult_form",
    name,
    email,
    phone,
    fbp: asString(body.fbp) ?? req.cookies.get("_fbp")?.value ?? null,
    fbclid: asString(body.fbclid),
    campaign: asString(body.utm_campaign),
    payload: {
      page_url: pageUrl,
      referrer: asString(body.referrer),
      message: asString(body.message),
      interest: asString(body.interest),
      cta_place: asString(body.cta_place),
      utm_source: asString(body.utm_source),
      utm_medium: asString(body.utm_medium),
      utm_campaign: asString(body.utm_campaign),
      utm_content: asString(body.utm_content),
      utm_term: asString(body.utm_term),
      fbp: asString(body.fbp) ?? req.cookies.get("_fbp")?.value ?? null,
      fbc: asString(body.fbc) ?? req.cookies.get("_fbc")?.value ?? null,
      fbclid: asString(body.fbclid),
      event_id: asString(body.event_id),
      client_ip: clientIp,
      user_agent: req.headers.get("user-agent"),
    },
  };

  const db = supabaseAdmin();
  const mode = await persistLeadBestEffort(db, lead);

  if (mode === "skipped") {
    return cors(
      NextResponse.json(
        { ok: false, error: "lead_persist_failed" },
        { status: 500 }
      )
    );
  }

  if (asString(body.event_id)) {
    await db.from("jobs").insert({
      type: "meta:capi",
      status: "pending",
      payload: {
        event_name: "Lead",
        event_id: asString(body.event_id),
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_source_url: pageUrl,
        content_name: product,
        content_type: "lead",
        content_ids: [product],
        email,
        phone,
        fbp: lead.fbp,
        fbc: asString(body.fbc) ?? req.cookies.get("_fbc")?.value ?? null,
        fbclid: lead.fbclid,
        ip_address: clientIp,
        user_agent: req.headers.get("user-agent"),
      },
    });
  }

  return cors(NextResponse.json({ ok: true, mode, order_ref: lead.order_ref }));
}
