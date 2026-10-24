import { ProductCode } from "@/lib/products";
import { asString } from "@/lib/strings";
import { asJson } from "@/lib/db/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type LeadRecord = {
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

type SupabaseLike = ReturnType<typeof supabaseAdmin>;

const LEAD_DEDUP_WINDOW_MS = 2 * 60 * 1000;

function hasRecentLead(createdAt: string | null | undefined, nowMs: number): boolean {
  if (!createdAt) return false;
  const ts = Date.parse(createdAt);
  if (Number.isNaN(ts)) return false;
  return nowMs - ts <= LEAD_DEDUP_WINDOW_MS;
}

async function findRecentDuplicateLead(sb: SupabaseLike, lead: LeadRecord): Promise<boolean> {
  const nowMs = Date.now();
  // A request is to one author: the same contact asking two authors within the
  // window is two leads, not a repeat.
  const authorSlug = asString(lead.payload.author_slug);
  const matches: Array<{ created_at?: string | null }> = [];

  if (lead.email) {
    let query = sb
      .from("leads")
      .select("created_at")
      .eq("product_code", lead.product_code)
      .eq("source", lead.source)
      .eq("email", lead.email);
    if (authorSlug) query = query.eq("payload->>author_slug", authorSlug);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(1);
    if (!error && data?.[0]) matches.push(data[0]);
  }

  if (lead.phone) {
    let query = sb
      .from("leads")
      .select("created_at")
      .eq("product_code", lead.product_code)
      .eq("source", lead.source)
      .eq("phone", lead.phone);
    if (authorSlug) query = query.eq("payload->>author_slug", authorSlug);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(1);
    if (!error && data?.[0]) matches.push(data[0]);
  }

  return matches.some((row) => hasRecentLead(row.created_at ?? null, nowMs));
}

export async function persistLeadBestEffort(
  sb: SupabaseLike,
  lead: LeadRecord,
): Promise<"leads" | "leads_deduped" | "events_fallback" | "skipped"> {
  if (await findRecentDuplicateLead(sb, lead)) {
    return "leads_deduped";
  }

  // Primary storage: separate leads list.
  const { error } = await sb.from("leads").insert({ ...lead, payload: asJson(lead.payload) });
  if (!error) return "leads";

  // Non-fatal fallback: preserve lead as event if leads table/columns mismatch.
  const { error: eventErr } = await sb.from("events").insert({
    type: "lead_captured",
    order_ref: lead.order_ref,
    payload: asJson(lead),
  });

  if (!eventErr) return "events_fallback";
  return "skipped";
}
