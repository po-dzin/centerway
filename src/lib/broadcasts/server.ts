/**
 * Broadcasts as the admin works with them: drafts, the audience, the send.
 *
 * Every mutation is a CONDITIONAL update on status, so two tabs cannot both
 * schedule the same campaign and an edit cannot land on one that is already
 * going out. Sending itself lives in `sender.ts`.
 */

import { serviceClient } from "@/lib/db/server";
import { sendEmail } from "@/lib/email/resend";
import { PRODUCTS } from "@/lib/products";

import { audienceIsEmpty, normalizeAudience, type Audience } from "./audience";
import { isSafeUrl } from "./render";
import { broadcastFrom, broadcastFromIsDedicated, buildRecipientEmail, enqueueBroadcastJob } from "./sender";

export type BroadcastStatus = "draft" | "scheduled" | "sending" | "sent" | "cancelled" | "failed";

export type Broadcast = {
  id: string;
  channel: "email" | "telegram";
  status: BroadcastStatus;
  title: string;
  subject: string;
  preheader: string;
  body: string;
  cta_label: string | null;
  cta_url: string | null;
  audience: Audience;
  scheduled_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  recipients_total: number;
  sent_count: number;
  failed_count: number;
  error_text: string | null;
  created_at: string;
  updated_at: string;
};

export type BroadcastStats = {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  skipped: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
};

export const EDITABLE_STATUSES: BroadcastStatus[] = ["draft", "scheduled", "cancelled", "failed"];
const SCHEDULABLE_FROM: BroadcastStatus[] = ["draft", "cancelled", "failed"];

export class BroadcastError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(code);
  }
}

function toBroadcast(row: Record<string, unknown>): Broadcast {
  return { ...(row as unknown as Broadcast), audience: normalizeAudience(row.audience) };
}

export async function listBroadcasts(input: { limit: number; offset: number; status?: string | null }) {
  let query = serviceClient()
    .from("broadcasts")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(input.offset, input.offset + input.limit - 1);
  if (input.status) query = query.eq("status", input.status);
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { data: (data ?? []).map(toBroadcast), count: count ?? 0 };
}

export async function getBroadcast(id: string): Promise<{ broadcast: Broadcast; stats: BroadcastStats } | null> {
  const db = serviceClient();
  const { data, error } = await db.from("broadcasts").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const stats = await db.rpc("broadcast_stats", { p_broadcast_id: id });
  if (stats.error) throw new Error(stats.error.message);
  return { broadcast: toBroadcast(data), stats: stats.data as unknown as BroadcastStats };
}

export type BroadcastDraftInput = Partial<
  Pick<Broadcast, "title" | "subject" | "preheader" | "body" | "cta_label" | "cta_url">
> & { audience?: unknown };

const LIMITS = { title: 200, subject: 200, preheader: 300, body: 50_000, cta_label: 80, cta_url: 2000 } as const;

export function sanitizeDraft(input: BroadcastDraftInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
    if (!(key in input)) continue;
    const raw = input[key];
    if (raw === null || raw === undefined) {
      if (key === "cta_label" || key === "cta_url") patch[key] = null;
      continue;
    }
    if (typeof raw !== "string") throw new BroadcastError(`${key}_invalid`);
    const value = key === "body" ? raw : raw.trim();
    if (value.length > LIMITS[key]) throw new BroadcastError(`${key}_too_long`);
    patch[key] = (key === "cta_label" || key === "cta_url") && value === "" ? null : value;
  }
  if (typeof patch.cta_url === "string" && !isSafeUrl(patch.cta_url)) throw new BroadcastError("cta_url_invalid");
  if ("audience" in input) patch.audience = normalizeAudience(input.audience);
  return patch;
}

export async function createBroadcast(input: BroadcastDraftInput, createdBy: string): Promise<Broadcast> {
  const patch = sanitizeDraft(input);
  const { data, error } = await serviceClient()
    .from("broadcasts")
    .insert({ channel: "email", status: "draft", ...patch, created_by: createdBy })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toBroadcast(data);
}

export async function updateBroadcast(id: string, input: BroadcastDraftInput): Promise<Broadcast> {
  const patch = sanitizeDraft(input);
  const { data, error } = await serviceClient()
    .from("broadcasts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", EDITABLE_STATUSES)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new BroadcastError("not_editable", 409);
  return toBroadcast(data);
}

export async function deleteBroadcast(id: string): Promise<void> {
  const { data, error } = await serviceClient()
    .from("broadcasts")
    .delete()
    .eq("id", id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new BroadcastError("only_drafts_can_be_deleted", 409);
}

export async function countAudience(audience: unknown): Promise<number> {
  const normalized = normalizeAudience(audience);
  if (audienceIsEmpty(normalized)) return 0;
  const { data, error } = await serviceClient().rpc("broadcast_audience_count", { p_audience: normalized });
  if (error) throw new Error(error.message);
  return data ?? 0;
}

function assertSendable(broadcast: Broadcast) {
  if (!broadcast.subject.trim()) throw new BroadcastError("subject_required");
  if (!broadcast.body.trim()) throw new BroadcastError("body_required");
  if (audienceIsEmpty(broadcast.audience)) throw new BroadcastError("audience_required");
  if (!process.env.RESEND_API_KEY) throw new BroadcastError("resend_not_configured", 503);
}

/**
 * Queue the campaign. `at` null means now. The audience count is taken here
 * too, so a rule that currently matches nobody is refused instead of producing
 * a campaign that «sent» to zero people.
 */
export async function scheduleBroadcast(id: string, at: Date | null) {
  const found = await getBroadcast(id);
  if (!found) throw new BroadcastError("not_found", 404);
  assertSendable(found.broadcast);

  const recipients = await countAudience(found.broadcast.audience);
  if (recipients === 0) throw new BroadcastError("audience_empty");

  const when = at && at.getTime() > Date.now() ? at : new Date();
  if (when.getTime() > Date.now() + 90 * 24 * 3600 * 1000) throw new BroadcastError("scheduled_too_far");

  const { data, error } = await serviceClient()
    .from("broadcasts")
    .update({ status: "scheduled", scheduled_at: when.toISOString(), error_text: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", SCHEDULABLE_FROM)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new BroadcastError("not_schedulable", 409);

  await enqueueBroadcastJob(id, when);
  return { broadcast: toBroadcast(data), recipients, immediate: when.getTime() <= Date.now() + 1000 };
}

/**
 * Stop a scheduled or running campaign. Rows already sent stay sent; the rest
 * stay pending, so scheduling again resumes where it stopped rather than
 * starting over.
 */
export async function cancelBroadcast(id: string): Promise<Broadcast> {
  const { data, error } = await serviceClient()
    .from("broadcasts")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["scheduled", "sending"])
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new BroadcastError("not_cancellable", 409);
  return toBroadcast(data);
}

/** One copy to the person editing, with {{name}} filled from the account. */
export async function sendTestBroadcast(id: string, to: string, name: string | null) {
  const found = await getBroadcast(id);
  if (!found) throw new BroadcastError("not_found", 404);
  const { broadcast } = found;
  if (!broadcast.subject.trim() || !broadcast.body.trim()) throw new BroadcastError("content_required");

  const email = buildRecipientEmail(
    {
      subject: `[Тест] ${broadcast.subject}`,
      preheader: broadcast.preheader,
      body: broadcast.body,
      ctaLabel: broadcast.cta_label,
      ctaUrl: broadcast.cta_url,
    },
    { address: to, name },
    null,
  );
  const result = await sendEmail({ ...email, idempotencyKey: undefined });
  if (!result.sent) {
    throw new BroadcastError(result.reason === "missing_api_key" ? "resend_not_configured" : "test_send_failed", 502);
  }
  return { to };
}

export type AudienceOptions = {
  products: { code: string; label: string; paid: number; leads: number }[];
  courses: { id: string; title: string; status: string }[];
  tags: { tag: string; count: number }[];
  sources: { source: string; count: number }[];
  sender: { from: string; dedicated: boolean };
};

/** What the audience picker can offer, read from the data rather than hard-coded. */
export async function audienceOptions(): Promise<AudienceOptions> {
  const db = serviceClient();
  const [orders, leads, courses, customers, subs] = await Promise.all([
    db.from("orders").select("product_code").eq("status", "paid").limit(20000),
    db.from("leads").select("product_code").not("email", "is", null).limit(20000),
    db.from("lms_courses").select("id, title, status").order("title"),
    db.from("customers").select("tags").limit(20000),
    db.from("messaging_subscriptions").select("source").eq("channel", "email").limit(50000),
  ]);
  for (const res of [orders, leads, courses, customers, subs]) {
    if (res.error) throw new Error(res.error.message);
  }

  const products = new Map<string, { paid: number; leads: number }>();
  const bump = (code: string | null, field: "paid" | "leads") => {
    if (!code) return;
    const entry = products.get(code) ?? { paid: 0, leads: 0 };
    entry[field]++;
    products.set(code, entry);
  };
  for (const row of orders.data ?? []) bump(row.product_code, "paid");
  for (const row of leads.data ?? []) bump(row.product_code, "leads");

  const tagCounts = new Map<string, number>();
  for (const row of customers.data ?? []) {
    for (const tag of row.tags ?? []) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
  const sourceCounts = new Map<string, number>();
  for (const row of subs.data ?? []) sourceCounts.set(row.source, (sourceCounts.get(row.source) ?? 0) + 1);

  const catalog = PRODUCTS as Record<string, { heading?: { uk?: string } }>;
  return {
    products: [...products.entries()]
      .map(([code, counts]) => ({ code, label: catalog[code]?.heading?.uk ?? code, ...counts }))
      .sort((a, b) => b.paid + b.leads - (a.paid + a.leads)),
    courses: (courses.data ?? []).map((c) => ({ id: c.id, title: c.title, status: c.status })),
    tags: [...tagCounts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count),
    sources: [...sourceCounts.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count),
    sender: { from: broadcastFrom(), dedicated: broadcastFromIsDedicated() },
  };
}
