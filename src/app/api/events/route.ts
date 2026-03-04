import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { CapiEventPayload } from "@/lib/tracking/capi";

export const runtime = "nodejs";

type EventsRequestBody = {
  event_name?: unknown;
  event_id?: unknown;
  value?: unknown;
  currency?: unknown;
  page_url?: unknown;
  fbp?: unknown;
  fbclid?: unknown;
  email?: unknown;
  phone?: unknown;
  content_name?: unknown;
  content_type?: unknown;
  content_ids?: unknown;
};

const ALLOWED_EVENT_NAMES = new Set<CapiEventPayload["event_name"]>([
  "ViewContent",
  "Lead",
  "InitiateCheckout",
]);

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s || null;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const arr = v
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return arr.length ? arr : undefined;
}

function clientIpFromHeaders(headers: Headers): string | null {
  return (
    headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    null
  );
}

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
  const body = (await req.json().catch(() => ({}))) as EventsRequestBody;
  const eventName = asString(body.event_name) as CapiEventPayload["event_name"] | null;
  const eventId = asString(body.event_id);
  if (!eventName || !ALLOWED_EVENT_NAMES.has(eventName)) {
    return cors(NextResponse.json({ ok: false, error: "invalid_event_name" }, { status: 400 }));
  }
  if (!eventId) {
    return cors(NextResponse.json({ ok: false, error: "event_id_required" }, { status: 400 }));
  }

  const payload: CapiEventPayload = {
    event_name: eventName,
    event_id: eventId,
    event_time: Math.floor(Date.now() / 1000),
    value: asNumber(body.value),
    currency: asString(body.currency) ?? undefined,
    event_source_url: asString(body.page_url) ?? req.headers.get("referer") ?? null,
    fbp: asString(body.fbp) ?? req.cookies.get("_fbp")?.value ?? null,
    fbclid: asString(body.fbclid),
    email: asString(body.email),
    phone: asString(body.phone),
    ip_address: clientIpFromHeaders(req.headers),
    user_agent: req.headers.get("user-agent"),
    action_source: "website",
    content_name: asString(body.content_name) ?? undefined,
    content_type: asString(body.content_type) ?? undefined,
    content_ids: asStringArray(body.content_ids),
  };

  const db = supabaseAdmin();
  await db.from("events").insert({
    type: "meta_event_enqueued",
    order_ref: null,
    payload: {
      event_name: payload.event_name,
      event_id: payload.event_id,
      event_source_url: payload.event_source_url ?? null,
    },
  });

  const { error } = await db.from("jobs").insert({
    type: "meta:capi",
    payload,
    status: "pending",
  });
  if (error) {
    return cors(
      NextResponse.json(
        { ok: false, error: "job_enqueue_failed", details: error.message ?? "unknown" },
        { status: 500 }
      )
    );
  }

  return cors(NextResponse.json({ ok: true }));
}
