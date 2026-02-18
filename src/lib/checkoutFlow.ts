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
  const conditions: string[] = [];
  if (lead.email) conditions.push(`email.eq.${lead.email}`);
  if (lead.phone) conditions.push(`phone.eq.${lead.phone}`);
  if (!conditions.length) return false;

  const { data, error } = await sb
    .from("leads")
    .select("id,created_at")
    .eq("product_code", lead.product_code)
    .eq("source", lead.source)
    .or(conditions.join(","))
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data?.length) return false;
  const row = data[0] as { created_at?: string | null };
  return hasRecentLead(row.created_at ?? null, Date.now());
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
