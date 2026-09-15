/**
 * The email base: who may be written to, and who must not be.
 *
 * `messaging_subscriptions` is both lists at once. A row with status
 * `subscribed` is consent; anything else is suppression, and the audience
 * function drops those addresses whatever rule asked for them. So the three
 * ways an address leaves — the unsubscribe link, a hard bounce, a spam
 * complaint — all end here, and none of them can be undone by an import.
 */

import { orIlikeFilter } from "@/lib/api/searchFilter";
import { serviceClient } from "@/lib/db/server";
import type { ImportRow } from "./csv";
import { normalizeEmail } from "./unsubscribeToken";

export type SubscriptionStatus = "subscribed" | "unsubscribed" | "bounced" | "complained";
export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ["subscribed", "unsubscribed", "bounced", "complained"];

export type SubscriptionItem = {
  id: string;
  address: string;
  name: string | null;
  status: SubscriptionStatus;
  source: string;
  status_reason: string | null;
  status_changed_at: string;
  created_at: string;
};

export type SubscriptionsPage = {
  data: SubscriptionItem[];
  count: number;
  totals: Partial<Record<SubscriptionStatus, number>>;
};

export function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return typeof value === "string" && (SUBSCRIPTION_STATUSES as string[]).includes(value);
}

/** `sendpulse`, `sendpulse:ivem`, `csv` — short, lowercase, safe to show and filter on. */
export function normalizeSource(value: unknown, fallback = "csv_import"): string {
  if (typeof value !== "string") return fallback;
  const clean = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return clean || fallback;
}

export async function listSubscriptions(input: {
  q?: string;
  status?: SubscriptionStatus | null;
  limit: number;
  offset: number;
}): Promise<SubscriptionsPage> {
  const db = serviceClient();
  let query = db
    .from("messaging_subscriptions")
    .select("id, address, name, status, source, status_reason, status_changed_at, created_at", { count: "exact" })
    .eq("channel", "email")
    .order("created_at", { ascending: false })
    .range(input.offset, input.offset + input.limit - 1);
  if (input.status) query = query.eq("status", input.status);
  const filter = orIlikeFilter(["address", "name", "source"], input.q?.trim() ?? "");
  if (filter) query = query.or(filter);

  const [{ data, error, count }, totals] = await Promise.all([query, db.rpc("messaging_subscription_counts")]);
  if (error) throw new Error(error.message);
  if (totals.error) throw new Error(totals.error.message);

  return {
    data: (data ?? []).map((row) => ({ ...row, status: row.status as SubscriptionStatus })),
    count: count ?? 0,
    totals: (totals.data ?? {}) as Partial<Record<SubscriptionStatus, number>>,
  };
}

/**
 * Move one address to a status.
 *
 * `onlyFrom` is what keeps the directions honest: an unsubscribe link must not
 * turn a hard bounce back into a mere «unsubscribed», and a resubscribe must
 * never lift a spam complaint. An address the base has never seen gets a row,
 * because a suppression has to hold even for someone who reached us through a
 * source other than an import.
 */
export async function setSubscriptionStatus(
  rawAddress: string,
  status: SubscriptionStatus,
  options: {
    source: string;
    reason?: string | null;
    broadcastId?: string | null;
    onlyFrom?: SubscriptionStatus[];
  },
): Promise<{ changed: boolean; status: SubscriptionStatus }> {
  const db = serviceClient();
  const address = normalizeEmail(rawAddress);
  const now = new Date().toISOString();

  const { data: existing, error: readError } = await db
    .from("messaging_subscriptions")
    .select("id, status")
    .eq("channel", "email")
    .eq("address", address)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  if (!existing) {
    const { error } = await db.from("messaging_subscriptions").insert({
      channel: "email",
      address,
      status,
      source: options.source,
      status_reason: options.reason ?? null,
      status_broadcast_id: options.broadcastId ?? null,
      status_changed_at: now,
    });
    // A concurrent insert of the same address is the same outcome.
    if (error && error.code !== "23505") throw new Error(error.message);
    return { changed: true, status };
  }

  const current = existing.status as SubscriptionStatus;
  if (current === status) return { changed: false, status };
  if (options.onlyFrom && !options.onlyFrom.includes(current)) return { changed: false, status: current };

  const { error } = await db
    .from("messaging_subscriptions")
    .update({
      status,
      status_reason: options.reason ?? null,
      status_broadcast_id: options.broadcastId ?? null,
      status_changed_at: now,
      updated_at: now,
    })
    .eq("id", existing.id);
  if (error) throw new Error(error.message);
  return { changed: true, status };
}

export type ImportResult = {
  received: number;
  inserted: number;
  alreadyKnown: number;
  suppressed: number;
};

/**
 * Bring a base in. New addresses are added; KNOWN addresses are left exactly as
 * they are — an import can add people but never re-subscribe anyone. Rows the
 * file itself marks unsubscribed or bounced are applied as suppressions.
 */
export async function importSubscribers(rows: ImportRow[], rawSource: string): Promise<ImportResult> {
  const db = serviceClient();
  const source = normalizeSource(rawSource);
  const result: ImportResult = { received: rows.length, inserted: 0, alreadyKnown: 0, suppressed: 0 };
  const now = new Date().toISOString();

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { data, error } = await db
      .from("messaging_subscriptions")
      .upsert(
        chunk.map((row) => ({
          channel: "email",
          address: normalizeEmail(row.email),
          name: row.name,
          status: row.status,
          source,
          status_reason: row.status === "subscribed" ? null : `import:${source}`,
          status_changed_at: now,
        })),
        { onConflict: "channel,address", ignoreDuplicates: true },
      )
      .select("id");
    if (error) throw new Error(error.message);
    const inserted = data?.length ?? 0;
    result.inserted += inserted;
    result.alreadyKnown += chunk.length - inserted;
  }

  // Suppressions in the file apply to known addresses too.
  for (const row of rows) {
    if (row.status === "subscribed") continue;
    const outcome = await setSubscriptionStatus(row.email, row.status, {
      source,
      reason: `import:${source}`,
      onlyFrom: ["subscribed"],
    });
    if (outcome.changed) result.suppressed++;
  }
  return result;
}

/**
 * A Resend event, applied. Only messages this app sent as part of a broadcast
 * are tracked; a transactional receipt's bounce is not a reason to take someone
 * off the marketing list.
 */
export async function applyResendEvent(event: {
  type: string;
  emailId: string | null;
  bounceType: string | null;
}): Promise<"applied" | "ignored"> {
  if (!event.emailId) return "ignored";
  const column = {
    "email.delivered": "delivered_at",
    "email.opened": "opened_at",
    "email.clicked": "clicked_at",
    "email.bounced": "bounced_at",
    "email.complained": "complained_at",
  }[event.type] as
    "delivered_at" | "opened_at" | "clicked_at" | "bounced_at" | "complained_at" | undefined;
  if (!column) return "ignored";

  const db = serviceClient();
  const { data: recipient, error } = await db
    .from("broadcast_recipients")
    .select("id, broadcast_id, address")
    .eq("provider_id", event.emailId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!recipient) return "ignored";

  // First occurrence only: a second open must not move the timestamp.
  const stamp: Partial<Record<typeof column, string>> = { [column]: new Date().toISOString() };
  const { error: updateError } = await db
    .from("broadcast_recipients")
    .update(stamp)
    .eq("id", recipient.id)
    .is(column, null);
  if (updateError) throw new Error(updateError.message);

  // A soft bounce (mailbox full, greylisting) is not a dead address.
  const hardBounce = event.type === "email.bounced" && (event.bounceType ?? "Permanent") === "Permanent";
  if (hardBounce || event.type === "email.complained") {
    await setSubscriptionStatus(recipient.address, hardBounce ? "bounced" : "complained", {
      source: "resend_webhook",
      reason: event.type,
      broadcastId: recipient.broadcast_id,
    });
  }
  return "applied";
}
