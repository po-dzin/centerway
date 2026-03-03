import { ProductCode } from "@/lib/products";
import { CheckoutStartRequest, buildCheckoutEventPayload } from "@/lib/checkout";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type LeadRecord = {
  order_ref: string;
  product_code: ProductCode;
  source: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  payload: Record<string, unknown>;
  fbp?: string | null;
  fbclid?: string | null;
  campaign?: string | null;
};

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s || null;
}

export function buildLeadRecord(
  body: CheckoutStartRequest,
  product: ProductCode,
  orderRef: string
): LeadRecord {
  return {
    order_ref: orderRef,
    product_code: product,
    source: "landing_checkout",
    name: asString(body.name),
    email: asString(body.email)?.toLowerCase() ?? null,
    phone: asString(body.phone),
    payload: buildCheckoutEventPayload(body),
    fbp: asString(body.fbp),
    fbclid: asString(body.fbclid),
    campaign: asString(body.utm_campaign),
  };
}

type SupabaseLike = ReturnType<typeof supabaseAdmin>;

const LEAD_DEDUP_WINDOW_MS = 2 * 60 * 1000;

function hasRecentLead(
  createdAt: string | null | undefined,
  nowMs: number
): boolean {
  if (!createdAt) return false;
  const ts = Date.parse(createdAt);
  if (Number.isNaN(ts)) return false;
  return nowMs - ts <= LEAD_DEDUP_WINDOW_MS;
}

async function findRecentDuplicateLead(sb: SupabaseLike, lead: LeadRecord): Promise<boolean> {
  const nowMs = Date.now();
  const matches: Array<{ created_at?: string | null }> = [];

  if (lead.email) {
    const { data, error } = await sb
      .from("leads")
      .select("created_at")
      .eq("product_code", lead.product_code)
      .eq("source", lead.source)
      .eq("email", lead.email)
      .order("created_at", { ascending: false })
      .limit(1);
    if (!error && data?.[0]) matches.push(data[0]);
  }

  if (lead.phone) {
    const { data, error } = await sb
      .from("leads")
      .select("created_at")
      .eq("product_code", lead.product_code)
      .eq("source", lead.source)
      .eq("phone", lead.phone)
      .order("created_at", { ascending: false })
      .limit(1);
    if (!error && data?.[0]) matches.push(data[0]);
  }

  return matches.some((row) => hasRecentLead(row.created_at ?? null, nowMs));
}

export async function persistLeadBestEffort(
  sb: SupabaseLike,
  lead: LeadRecord
): Promise<"leads" | "leads_deduped" | "events_fallback" | "skipped"> {
  if (await findRecentDuplicateLead(sb, lead)) {
    return "leads_deduped";
  }

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
