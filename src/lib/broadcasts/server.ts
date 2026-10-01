/**
 * Broadcasts — the platform's own mailing list (replacing SendPulse).
 *
 * Schema and the SQL half of the contract: supabase/migrations/20260915000000_broadcasts.sql.
 * Narrative and the operator's runbook: docs/broadcasts-2026-09-15.md.
 *
 * THE LIFECYCLE
 *
 *   draft ──start──▶ sending ──(no row left pending)──▶ sent
 *     │                 │
 *     └──delete         └──cancel──▶ cancelled (pending rows → skipped)
 *
 * Only a draft can be edited. `start` freezes the audience into
 * `broadcast_recipients` — after that the words and the list are what they
 * were when the owner pressed the button, and a retry resumes instead of
 * re-mailing.
 *
 * WHO DRIVES THE SENDING. The deployment has no scheduler (vercel.json has no
 * crons on this plan), so a batch is sent per request, and the admin page
 * keeps asking for the next batch while it is open. Close the tab mid-way and
 * the campaign stays `sending` with its remaining rows pending; open it again
 * and «Продовжити» picks up where it stopped. A claim older than fifteen
 * minutes is taken again (SQL), so a request that died mid-batch is not lost.
 *
 * Authorization is the route's (`requireAdmin`); this module trusts its caller.
 */

import { createHash } from "node:crypto";

import { serviceClient } from "@/lib/db/server";
import { asJson } from "@/lib/db/types";
import { sendEmail, sendEmailBatch, PURCHASE_FROM } from "@/lib/email/resend";
import { platformUrl } from "@/lib/surfaces/catalog";
import { audienceFromRow, parseAudience, type Audience } from "./audience";
import { isSafeUrl, renderBroadcast, type BroadcastContent } from "./render";
import { createUnsubscribeToken, type UnsubscribeClaim } from "./unsubscribeToken";

type Db = ReturnType<typeof serviceClient>;

export class BroadcastError extends Error {
  constructor(
    readonly code: string,
    readonly status = 400,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = "BroadcastError";
  }
}

export const BROADCAST_STATUSES = ["draft", "scheduled", "sending", "sent", "cancelled", "failed"] as const;
export type BroadcastStatus = (typeof BROADCAST_STATUSES)[number];

/** One batch per request. Under the provider's 100, so a slow batch still answers well inside a function's timeout. */
export const BATCH_SIZE = 50;

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

export type BroadcastSummary = {
  id: string;
  status: BroadcastStatus;
  title: string;
  subject: string;
  recipientsTotal: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type BroadcastDetail = BroadcastSummary & {
  preheader: string;
  body: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  audience: Audience;
  errorText: string | null;
  stats: BroadcastStats | null;
};

type BroadcastRow = {
  id: string;
  status: string;
  title: string;
  subject: string;
  preheader: string;
  body: string;
  cta_label: string | null;
  cta_url: string | null;
  audience: unknown;
  recipients_total: number;
  sent_count: number;
  failed_count: number;
  error_text: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

const ROW_COLUMNS =
  "id, status, title, subject, preheader, body, cta_label, cta_url, audience, recipients_total, sent_count, failed_count, error_text, created_at, started_at, finished_at";

function asStatus(value: string): BroadcastStatus {
  return (BROADCAST_STATUSES as readonly string[]).includes(value) ? (value as BroadcastStatus) : "draft";
}

function toSummary(row: BroadcastRow): BroadcastSummary {
  return {
    id: row.id,
    status: asStatus(row.status),
    title: row.title,
    subject: row.subject,
    recipientsTotal: row.recipients_total,
    sentCount: row.sent_count,
    failedCount: row.failed_count,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

function toDetail(row: BroadcastRow, stats: BroadcastStats | null): BroadcastDetail {
  return {
    ...toSummary(row),
    preheader: row.preheader,
    body: row.body,
    ctaLabel: row.cta_label,
    ctaUrl: row.cta_url,
    audience: audienceFromRow(row.audience),
    errorText: row.error_text,
    stats,
  };
}

function contentOf(row: BroadcastRow): BroadcastContent {
  return {
    subject: row.subject,
    preheader: row.preheader,
    body: row.body,
    ctaLabel: row.cta_label,
    ctaUrl: row.cta_url,
  };
}

/** `BROADCAST_FROM` when set, so marketing can move to its own sending subdomain without a deploy of code. */
export function broadcastFrom(): string {
  return process.env.BROADCAST_FROM?.trim() || PURCHASE_FROM;
}

export function unsubscribeUrl(claim: UnsubscribeClaim): string {
  return platformUrl(`/api/unsubscribe?t=${encodeURIComponent(createUnsubscribeToken(claim))}`);
}

async function loadRow(db: Db, id: string): Promise<BroadcastRow> {
  const { data, error } = await db.from("broadcasts").select(ROW_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new BroadcastError(error.message, 500);
  if (!data) throw new BroadcastError("broadcast_not_found", 404);
  return data as BroadcastRow;
}

async function loadStats(db: Db, id: string): Promise<BroadcastStats | null> {
  const { data, error } = await db.rpc("broadcast_stats", { p_broadcast_id: id });
  if (error) throw new BroadcastError(error.message, 500);
  return (data as BroadcastStats | null) ?? null;
}

// ─── Reading ─────────────────────────────────────────────────────────────────

export async function listBroadcasts(db: Db = serviceClient()): Promise<BroadcastSummary[]> {
  const { data, error } = await db
    .from("broadcasts")
    .select(ROW_COLUMNS)
    .eq("channel", "email")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new BroadcastError(error.message, 500);
  return ((data ?? []) as BroadcastRow[]).map(toSummary);
}

export async function getBroadcast(id: string, db: Db = serviceClient()): Promise<BroadcastDetail> {
  const row = await loadRow(db, id);
  const stats = row.status === "draft" ? null : await loadStats(db, id);
  return toDetail(row, stats);
}

export async function countAudience(audience: Audience, db: Db = serviceClient()): Promise<number> {
  if (audience.include.length === 0) return 0;
  const { data, error } = await db.rpc("broadcast_audience_count", { p_audience: asJson(audience) });
  if (error) throw new BroadcastError(error.message, 500);
  return Number(data ?? 0);
}

/** A few addresses from the audience, so the owner can see WHO a rule means, not only how many. */
export async function sampleAudience(
  audience: Audience,
  limit = 10,
  db: Db = serviceClient(),
): Promise<{ address: string; name: string | null }[]> {
  if (audience.include.length === 0) return [];
  const { data, error } = await db.rpc("broadcast_audience", { p_audience: asJson(audience) }).limit(limit);
  if (error) throw new BroadcastError(error.message, 500);
  return (data ?? []).map((row) => ({ address: row.address, name: row.name ?? null }));
}

export type AudienceOptions = {
  products: { code: string; buyers: number }[];
  courses: { id: string; title: string }[];
  tags: string[];
  sources: string[];
};

/**
 * What the audience editor can offer: the products people actually paid for,
 * the courses, the customer tags and the subscription sources in use. Read
 * from the data rather than from a list in code, so a new product is a
 * choice the day its first order is paid.
 */
export async function audienceOptions(db: Db = serviceClient()): Promise<AudienceOptions> {
  const [orders, courses, customers, subscriptions] = await Promise.all([
    db.from("orders").select("product_code, customer_id").eq("status", "paid").limit(20000),
    db.from("lms_courses").select("id, title").order("title").limit(500),
    db.from("customers").select("tags").not("tags", "is", null).limit(20000),
    db.from("messaging_subscriptions").select("source").eq("channel", "email").limit(50000),
  ]);
  for (const res of [orders, courses, customers, subscriptions]) {
    if (res.error) throw new BroadcastError(res.error.message, 500);
  }

  const buyers = new Map<string, Set<string>>();
  for (const row of orders.data ?? []) {
    if (!row.product_code) continue;
    const set = buyers.get(row.product_code) ?? new Set<string>();
    if (row.customer_id) set.add(row.customer_id);
    buyers.set(row.product_code, set);
  }
  const tags = new Set<string>();
  for (const row of customers.data ?? []) for (const tag of (row.tags as string[] | null) ?? []) tags.add(tag);
  const sources = new Set<string>((subscriptions.data ?? []).map((row) => row.source));

  return {
    products: [...buyers.entries()]
      .map(([code, set]) => ({ code, buyers: set.size }))
      .sort((a, b) => b.buyers - a.buyers || a.code.localeCompare(b.code)),
    courses: (courses.data ?? []).map((row) => ({ id: row.id, title: row.title })),
    tags: [...tags].sort(),
    sources: [...sources].sort(),
  };
}

// ─── Writing a draft ─────────────────────────────────────────────────────────

export type DraftInput = {
  title?: unknown;
  subject?: unknown;
  preheader?: unknown;
  body?: unknown;
  ctaLabel?: unknown;
  ctaUrl?: unknown;
  audience?: unknown;
};

const LIMITS = { title: 200, subject: 250, preheader: 250, body: 50_000, ctaLabel: 80, ctaUrl: 2000 } as const;

function text(value: unknown, field: keyof typeof LIMITS): string | undefined {
  if (value === undefined) return undefined;
  if (value === null) return "";
  if (typeof value !== "string") throw new BroadcastError(`${field}_invalid`);
  if (value.length > LIMITS[field]) throw new BroadcastError(`${field}_too_long`);
  return value;
}

/** A partial draft from a request body, as columns. Unknown or malformed fields are refused, not dropped. */
export function draftPatch(input: DraftInput) {
  const patch: {
    title?: string;
    subject?: string;
    preheader?: string;
    body?: string;
    cta_label?: string | null;
    cta_url?: string | null;
    audience?: ReturnType<typeof asJson>;
  } = {};
  const title = text(input.title, "title");
  if (title !== undefined) patch.title = title.trim();
  const subject = text(input.subject, "subject");
  if (subject !== undefined) patch.subject = subject;
  const preheader = text(input.preheader, "preheader");
  if (preheader !== undefined) patch.preheader = preheader;
  const body = text(input.body, "body");
  if (body !== undefined) patch.body = body;
  const ctaLabel = text(input.ctaLabel, "ctaLabel");
  if (ctaLabel !== undefined) patch.cta_label = ctaLabel.trim() || null;
  const ctaUrl = text(input.ctaUrl, "ctaUrl");
  if (ctaUrl !== undefined) {
    const trimmed = ctaUrl.trim();
    if (trimmed && !isSafeUrl(trimmed)) throw new BroadcastError("ctaUrl_invalid");
    patch.cta_url = trimmed || null;
  }
  if (input.audience !== undefined) {
    const audience = parseAudience(input.audience);
    if (!audience) throw new BroadcastError("audience_invalid");
    patch.audience = asJson(audience);
  }
  return patch;
}

export async function createBroadcast(
  actorId: string,
  input: DraftInput,
  db: Db = serviceClient(),
): Promise<BroadcastDetail> {
  const patch = draftPatch(input);
  const { data, error } = await db
    .from("broadcasts")
    .insert({ channel: "email", status: "draft", created_by: actorId, ...patch })
    .select(ROW_COLUMNS)
    .single();
  if (error) throw new BroadcastError(error.message, 500);
  return toDetail(data as BroadcastRow, null);
}

export async function updateDraft(id: string, input: DraftInput, db: Db = serviceClient()): Promise<BroadcastDetail> {
  const patch = draftPatch(input);
  // The status condition is in the UPDATE itself, so a draft that started
  // sending between the read and the write is not edited under the sender.
  const { data, error } = await db
    .from("broadcasts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft")
    .select(ROW_COLUMNS)
    .maybeSingle();
  if (error) throw new BroadcastError(error.message, 500);
  if (!data) {
    await loadRow(db, id); // 404 when it does not exist at all
    throw new BroadcastError("broadcast_not_draft", 409);
  }
  return toDetail(data as BroadcastRow, null);
}

export async function deleteDraft(id: string, db: Db = serviceClient()): Promise<void> {
  const { data, error } = await db.from("broadcasts").delete().eq("id", id).eq("status", "draft").select("id");
  if (error) throw new BroadcastError(error.message, 500);
  if (!data?.length) {
    await loadRow(db, id);
    throw new BroadcastError("broadcast_not_draft", 409);
  }
}

/** Duplicate any campaign as a new draft — the way to resend, fix and resend, or reuse last month's letter. */
export async function duplicateBroadcast(
  id: string,
  actorId: string,
  db: Db = serviceClient(),
): Promise<BroadcastDetail> {
  const row = await loadRow(db, id);
  return createBroadcast(
    actorId,
    {
      title: `${row.title || row.subject} (копія)`.slice(0, LIMITS.title),
      subject: row.subject,
      preheader: row.preheader,
      body: row.body,
      ctaLabel: row.cta_label,
      ctaUrl: row.cta_url,
      audience: audienceFromRow(row.audience),
    },
    db,
  );
}

function assertSendable(row: BroadcastRow, audience: Audience) {
  if (!row.subject.trim()) throw new BroadcastError("subject_required");
  if (!row.body.trim()) throw new BroadcastError("body_required");
  if (audience.include.length === 0) throw new BroadcastError("audience_required");
}

// ─── Test send ───────────────────────────────────────────────────────────────

/**
 * The draft, as one recipient would get it, to one address — the operator's own.
 *
 * Marked «[Тест]» in the subject and never recorded as a recipient, so it does
 * not count in the stats and does not stop the real send reaching the same
 * address. The unsubscribe link in it is real and works on the tester's own
 * address, which is the honest way to test it.
 */
export async function sendTest(
  id: string,
  to: string,
  recipientName: string | null,
  db: Db = serviceClient(),
): Promise<{ id: string }> {
  const row = await loadRow(db, id);
  if (!row.subject.trim() || !row.body.trim()) throw new BroadcastError("content_required");
  const address = to.trim().toLowerCase();
  const message = renderBroadcast(
    contentOf(row),
    { name: recipientName },
    unsubscribeUrl({ address, broadcastId: null }),
  );
  const result = await sendEmail({
    to: address,
    from: broadcastFrom(),
    subject: `[Тест] ${message.subject}`,
    html: message.html,
    text: message.text,
    headers: message.headers,
  });
  if (!result.sent) {
    if (result.reason === "missing_api_key") throw new BroadcastError("resend_not_configured", 503);
    throw new BroadcastError("test_send_failed", 502, { detail: result.detail ?? result.reason });
  }
  return { id: result.id };
}

// ─── Sending ─────────────────────────────────────────────────────────────────

export type SendProgress = {
  status: BroadcastStatus;
  stats: BroadcastStats | null;
  /** Why this request sent nothing although rows remain; the page stops asking and says so. */
  paused?: "rate_limited" | "busy";
  detail?: string;
};

/**
 * Freeze the audience and open the campaign for sending.
 *
 * `confirmCount` is the number the owner saw and confirmed. If the rule now
 * means a different number — a sale came in, someone unsubscribed — nothing is
 * frozen and the new number goes back to be confirmed again: what was
 * approved is what goes out.
 */
export async function startBroadcast(
  id: string,
  confirmCount: number,
  db: Db = serviceClient(),
): Promise<SendProgress> {
  const row = await loadRow(db, id);
  if (row.status !== "draft") throw new BroadcastError("broadcast_not_draft", 409);
  const audience = audienceFromRow(row.audience);
  assertSendable(row, audience);

  // Before anything is frozen: a campaign that cannot send should stay a draft.
  if (!process.env.RESEND_API_KEY) throw new BroadcastError("resend_not_configured", 503);

  const count = await countAudience(audience, db);
  if (count === 0) throw new BroadcastError("audience_empty");
  if (count !== confirmCount) throw new BroadcastError("audience_changed", 409, { count });

  /* Claim the draft first, conditionally: of two presses only one turns a
     draft into `sending`, and only that one freezes the list. */
  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await db
    .from("broadcasts")
    .update({ status: "sending", started_at: now, updated_at: now, error_text: null })
    .eq("id", id)
    .eq("status", "draft")
    .select("id");
  if (claimError) throw new BroadcastError(claimError.message, 500);
  if (!claimed?.length) throw new BroadcastError("broadcast_not_draft", 409);

  const { data: frozen, error } = await db.rpc("broadcast_materialize", { p_broadcast_id: id });
  if (error) {
    await db
      .from("broadcasts")
      .update({ status: "failed", error_text: `materialize: ${error.message}`, updated_at: new Date().toISOString() })
      .eq("id", id);
    throw new BroadcastError(error.message, 500);
  }

  /* The count above and the snapshot are two statements: a sale or an
     unsubscribe can land between them. The snapshot is what would be sent, so
     it is the number checked — and if it is not the confirmed one, the frozen
     rows are dropped and the campaign goes back to being a draft, before a
     single message leaves. */
  const frozenCount = Number(frozen ?? 0);
  if (frozenCount !== confirmCount) {
    await db.from("broadcast_recipients").delete().eq("broadcast_id", id);
    await db
      .from("broadcasts")
      .update({ status: "draft", started_at: null, recipients_total: 0, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "sending");
    throw new BroadcastError("audience_changed", 409, { count: frozenCount });
  }

  return sendNextBatch(id, db);
}

async function remaining(db: Db, id: string): Promise<number> {
  const { count, error } = await db
    .from("broadcast_recipients")
    .select("id", { count: "exact", head: true })
    .eq("broadcast_id", id)
    .in("status", ["pending", "sending"]);
  if (error) throw new BroadcastError(error.message, 500);
  return count ?? 0;
}

async function finishIfDone(db: Db, id: string): Promise<boolean> {
  if ((await remaining(db, id)) > 0) return false;
  const now = new Date().toISOString();
  await db
    .from("broadcasts")
    .update({ status: "sent", finished_at: now, updated_at: now })
    .eq("id", id)
    .eq("status", "sending");
  return true;
}

/** One batch: claim, render, hand to the provider, record. Safe to call concurrently and to repeat. */
export async function sendNextBatch(id: string, db: Db = serviceClient()): Promise<SendProgress> {
  const row = await loadRow(db, id);
  if (row.status !== "sending") return { status: asStatus(row.status), stats: await loadStats(db, id) };

  const { data: claimed, error: claimError } = await db.rpc("broadcast_claim_recipients", {
    p_broadcast_id: id,
    p_limit: BATCH_SIZE,
  });
  if (claimError) throw new BroadcastError(claimError.message, 500);
  const rows = claimed ?? [];

  if (rows.length === 0) {
    const done = await finishIfDone(db, id);
    return {
      status: done ? "sent" : "sending",
      stats: await loadStats(db, id),
      ...(done ? {} : { paused: "busy" as const }),
    };
  }

  const content = contentOf(row);
  const from = broadcastFrom();
  const messages = rows.map((recipient) => {
    const message = renderBroadcast(
      content,
      { name: recipient.name },
      unsubscribeUrl({ address: recipient.address, broadcastId: id }),
    );
    return { to: recipient.address, from, ...message };
  });

  /* Derived from the rows, not the attempt: a batch re-claimed after a crash
     carries the same key, and the provider refuses to deliver it twice. */
  const idempotencyKey = `broadcast-${id}-${createHash("sha256")
    .update(rows.map((r) => r.id).join(","))
    .digest("hex")
    .slice(0, 32)}`;
  const result = await sendEmailBatch(messages, { idempotencyKey });

  let results: { id: string; status: string; provider_id: string | null; error_text: string | null }[];
  let paused: SendProgress["paused"];
  if (result.sent) {
    results = rows.map((r, i) => ({ id: r.id, status: "sent", provider_id: result.ids[i] ?? null, error_text: null }));
  } else if (
    result.reason === "rate_limited" ||
    result.reason === "provider_unavailable" ||
    result.reason === "missing_api_key" ||
    result.reason === "network_error"
  ) {
    /* Not the addresses' fault: put the rows back. A quota or an outage is a
       pause; marking three hundred people `failed` for it would be a lie the
       retry button then has to undo. */
    results = rows.map((r) => ({
      id: r.id,
      status: "pending",
      provider_id: null,
      error_text: result.detail ?? result.reason,
    }));
    paused = "rate_limited";
  } else {
    results = rows.map((r) => ({
      id: r.id,
      status: "failed",
      provider_id: null,
      error_text: result.detail ?? result.reason,
    }));
  }

  const { error: markError } = await db.rpc("broadcast_mark_results", {
    p_broadcast_id: id,
    p_results: asJson(results),
  });
  if (markError) throw new BroadcastError(markError.message, 500);

  if (!result.sent && result.reason === "missing_api_key") throw new BroadcastError("resend_not_configured", 503);

  const done = !paused && (await finishIfDone(db, id));
  return {
    status: done ? "sent" : "sending",
    stats: await loadStats(db, id),
    ...(paused ? { paused, detail: result.sent ? undefined : result.detail } : {}),
  };
}

/** Stop a campaign: whatever was not handed to the provider yet is skipped. */
export async function cancelBroadcast(id: string, db: Db = serviceClient()): Promise<SendProgress> {
  const row = await loadRow(db, id);
  if (row.status !== "sending" && row.status !== "scheduled") throw new BroadcastError("broadcast_not_sending", 409);
  const now = new Date().toISOString();
  const { error } = await db
    .from("broadcasts")
    .update({ status: "cancelled", finished_at: now, updated_at: now })
    .eq("id", id)
    .in("status", ["sending", "scheduled"]);
  if (error) throw new BroadcastError(error.message, 500);
  await db
    .from("broadcast_recipients")
    .update({ status: "skipped", error_text: "cancelled" })
    .eq("broadcast_id", id)
    .eq("status", "pending");
  return { status: "cancelled", stats: await loadStats(db, id) };
}

/** Give failed rows another go: back to pending, campaign back to sending. */
export async function retryFailed(id: string, db: Db = serviceClient()): Promise<SendProgress> {
  const row = await loadRow(db, id);
  if (row.status !== "sent" && row.status !== "sending" && row.status !== "failed") {
    throw new BroadcastError("broadcast_not_retryable", 409);
  }
  const { data, error } = await db
    .from("broadcast_recipients")
    .update({ status: "pending", error_text: null, claimed_at: null })
    .eq("broadcast_id", id)
    .eq("status", "failed")
    .select("id");
  if (error) throw new BroadcastError(error.message, 500);
  if (!data?.length) return { status: asStatus(row.status), stats: await loadStats(db, id) };
  await db
    .from("broadcasts")
    .update({ status: "sending", finished_at: null, updated_at: new Date().toISOString() })
    .eq("id", id);
  return sendNextBatch(id, db);
}

// ─── Subscriptions: the list, the import, the way out ────────────────────────

export type SubscriptionCounts = Partial<Record<"subscribed" | "unsubscribed" | "bounced" | "complained", number>>;

export async function subscriptionCounts(db: Db = serviceClient()): Promise<SubscriptionCounts> {
  const { data, error } = await db.rpc("messaging_subscription_counts");
  if (error) throw new BroadcastError(error.message, 500);
  return (data as SubscriptionCounts | null) ?? {};
}

export type SubscriptionRow = {
  address: string;
  name: string | null;
  status: string;
  source: string;
  statusReason: string | null;
  statusChangedAt: string;
};

export async function listSubscriptions(
  { status, q, limit, offset }: { status: string; q: string; limit: number; offset: number },
  db: Db = serviceClient(),
): Promise<{ data: SubscriptionRow[]; count: number }> {
  let query = db
    .from("messaging_subscriptions")
    .select("address, name, status, source, status_reason, status_changed_at", { count: "exact" })
    .eq("channel", "email");
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("address", `%${q.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  const { data, error, count } = await query
    .order("status_changed_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new BroadcastError(error.message, 500);
  return {
    data: (data ?? []).map((row) => ({
      address: row.address,
      name: row.name,
      status: row.status,
      source: row.source,
      statusReason: row.status_reason,
      statusChangedAt: row.status_changed_at,
    })),
    count: count ?? 0,
  };
}

const EMAIL = /^[^@\s,;<>"]+@[^@\s,;<>"]+\.[^@\s,;<>"]+$/;

/**
 * Lines of `email` or `email, name` (comma, semicolon or tab) — a SendPulse
 * export pasted as it is, header row and quotes included.
 */
export function parseImport(raw: string): { rows: { address: string; name: string | null }[]; invalid: string[] } {
  const rows = new Map<string, string | null>();
  const invalid: string[] = [];
  for (const line of raw.replace(/\r\n?/g, "\n").split("\n")) {
    const cells = line.split(/[,;\t]/).map((cell) =>
      cell
        .trim()
        .replace(/^"(.*)"$/, "$1")
        .trim(),
    );
    const emailIndex = cells.findIndex((cell) => cell.includes("@"));
    if (emailIndex === -1) {
      if (line.trim() && !/e-?mail|пошта|почта/i.test(line)) invalid.push(line.trim().slice(0, 120));
      continue;
    }
    const cell = cells[emailIndex] ?? "";
    const address = cell.toLowerCase();
    if (!EMAIL.test(address)) {
      invalid.push(cell.slice(0, 120));
      continue;
    }
    const name =
      cells.find((cell, i) => i !== emailIndex && cell && !cell.includes("@") && !/^\d+$/.test(cell)) ?? null;
    if (!rows.has(address) || (!rows.get(address) && name)) rows.set(address, name);
  }
  return { rows: [...rows.entries()].map(([address, name]) => ({ address, name })), invalid };
}

/**
 * Add addresses as subscribed. An address the list already knows is left
 * EXACTLY as it is — above all, an import never resubscribes someone who
 * unsubscribed, bounced or complained. That is the line between a mailing
 * list and spam.
 */
export async function importSubscriptions(
  raw: string,
  source: "csv_import" | "sendpulse_import" | "manual",
  db: Db = serviceClient(),
): Promise<{ added: number; existing: number; invalid: string[] }> {
  const { rows, invalid } = parseImport(raw);
  if (rows.length > 20000) throw new BroadcastError("import_too_large");
  let added = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { data, error } = await db
      .from("messaging_subscriptions")
      .upsert(
        chunk.map((row) => ({ channel: "email", address: row.address, name: row.name, source, status: "subscribed" })),
        { onConflict: "channel,address", ignoreDuplicates: true },
      )
      .select("id");
    if (error) throw new BroadcastError(error.message, 500);
    added += data?.length ?? 0;
  }
  return { added, existing: rows.length - added, invalid: invalid.slice(0, 50) };
}

export type SuppressionStatus = "unsubscribed" | "bounced" | "complained";

/**
 * Take an address off the list (or, for `subscribed` from the panel, put a
 * manual unsubscribe back). A bounce or complaint is never overwritten by a
 * weaker status: a complaint stays a complaint even if the same person later
 * presses «unsubscribe» too.
 */
export async function setSubscriptionStatus(
  address: string,
  status: SuppressionStatus,
  { source, reason, broadcastId }: { source: string; reason: string; broadcastId: string | null },
  db: Db = serviceClient(),
): Promise<void> {
  const normalized = address.trim().toLowerCase();
  if (!EMAIL.test(normalized)) throw new BroadcastError("address_invalid");
  const now = new Date().toISOString();

  const { data: existing, error: readError } = await db
    .from("messaging_subscriptions")
    .select("id, status")
    .eq("channel", "email")
    .eq("address", normalized)
    .maybeSingle();
  if (readError) throw new BroadcastError(readError.message, 500);

  const rank = (s: string) => ({ subscribed: 0, unsubscribed: 1, bounced: 2, complained: 3 })[s] ?? 0;
  if (existing) {
    if (rank(existing.status) >= rank(status)) return;
    const { error } = await db
      .from("messaging_subscriptions")
      .update({
        status,
        status_reason: reason,
        status_broadcast_id: broadcastId,
        status_changed_at: now,
        updated_at: now,
      })
      .eq("id", existing.id);
    if (error) throw new BroadcastError(error.message, 500);
    return;
  }

  const { error } = await db.from("messaging_subscriptions").upsert(
    {
      channel: "email",
      address: normalized,
      status,
      source,
      status_reason: reason,
      status_broadcast_id: broadcastId,
      status_changed_at: now,
    },
    { onConflict: "channel,address" },
  );
  if (error) throw new BroadcastError(error.message, 500);
}

/** An operator putting a MANUALLY unsubscribed address back. Bounces and complaints stay. */
export async function resubscribeManually(address: string, db: Db = serviceClient()): Promise<void> {
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("messaging_subscriptions")
    .update({ status: "subscribed", status_reason: "manual", status_changed_at: now, updated_at: now })
    .eq("channel", "email")
    .eq("address", address.trim().toLowerCase())
    .eq("status", "unsubscribed")
    .eq("status_reason", "manual")
    .select("id");
  if (error) throw new BroadcastError(error.message, 500);
  if (!data?.length) throw new BroadcastError("resubscribe_not_allowed", 409);
}
