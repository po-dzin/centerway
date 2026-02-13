import { ProductCode } from "@/lib/products";
import { CheckoutStartRequest, buildCheckoutEventPayload } from "@/lib/checkout";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type LeadRecord = {
  order_ref: string;
  product_code: ProductCode;
  source: string;
  site: string | null;
  offer_id: string | null;
  email: string | null;
  phone: string | null;
  event_id: string | null;
  value: number | null;
  currency: string | null;
  host: string | null;
  payload: Record<string, unknown>;
};

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s || null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function buildLeadRecord(
  body: CheckoutStartRequest,
  product: ProductCode,
  orderRef: string,
  host: string | null
): LeadRecord {
  return {
    order_ref: orderRef,
    product_code: product,
    source: "landing_checkout",
    site: asString(body.site),
    offer_id: asString(body.offer_id),
    email: asString(body.email)?.toLowerCase() ?? null,
    phone: asString(body.phone),
    event_id: asString(body.event_id),
    value: asNumber(body.value),
    currency: asString(body.currency)?.toUpperCase() ?? null,
    host,
    payload: buildCheckoutEventPayload(body),
  };
}

type SupabaseLike = ReturnType<typeof supabaseAdmin>;

export async function persistLeadBestEffort(sb: SupabaseLike, lead: LeadRecord): Promise<"leads" | "events_fallback" | "skipped"> {
  // Primary storage: separate leads list.
  const { error } = await sb.from("leads").insert(lead);
  if (!error) return "leads";

  // Non-fatal fallback: preserve lead as event if leads table/columns mismatch.
  const { error: eventErr } = await sb.from("events").insert({
    type: "lead_captured",
    order_ref: lead.order_ref,
    payload: lead,
  });

  if (!eventErr) return "events_fallback";
  return "skipped";
}

