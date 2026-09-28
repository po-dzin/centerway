/**
 * Sending a broadcast — the `broadcast:send` job.
 *
 * THE SHAPE. The editor never sends. «Надіслати» moves the campaign to
 * `scheduled` and queues one job at `scheduled_at`; this handler does the rest
 * in slices small enough for one serverless invocation:
 *
 *   scheduled → sending   freeze the audience into broadcast_recipients
 *   sending               claim ≤100 rows, render, one Resend batch call, mark
 *                         … repeat until the time budget is spent
 *   budget spent          queue a continuation and return
 *   nothing left          → sent
 *
 * WHY IT CANNOT DOUBLE-MAIL IN THE ORDINARY CASE. Rows are claimed with
 * `FOR UPDATE SKIP LOCKED`, so two workers never hold the same address. The
 * batch carries an Idempotency-Key made from its row ids, so a batch retried
 * within 24 hours after a crash between «Resend accepted» and «we wrote sent»
 * is refused by the provider. What remains is a crash AND a different batch
 * composition on retry — rare, and the price of not holding a lock across a
 * network call.
 *
 * WHY IT CANNOT SILENTLY STALL. Every exit that leaves work behind queues a
 * continuation; a throw lets the job queue retry with backoff; a worker that
 * died mid-claim has its rows reclaimed after 15 minutes by the claim function
 * itself.
 */

import { createHash } from "node:crypto";

import { serviceClient } from "@/lib/db/server";
import { PURCHASE_FROM, RESEND_BATCH_MAX, sendEmail, sendEmailBatch, type BatchEmail } from "@/lib/email/resend";
import { getErrorMessage } from "@/lib/errors";
import { PLATFORM_ORIGIN } from "@/lib/surfaces/catalog";

import { renderBroadcastEmail, type BroadcastContent } from "./render";
import { createUnsubscribeToken } from "./unsubscribeToken";

export const BROADCAST_JOB_TYPE = "broadcast:send";

const DEFAULT_BUDGET_MS = 45_000;
const PAUSE_BETWEEN_BATCHES_MS = 400;
const RETRY_LATER_MS = 60_000;

/**
 * Marketing should leave from its own subdomain so a bad campaign cannot hurt
 * the delivery of receipts (see resend.ts). Until `BROADCAST_FROM` is set it
 * falls back to the transactional sender, and the editor says so.
 */
export function broadcastFrom(): string {
  return process.env.BROADCAST_FROM?.trim() || PURCHASE_FROM;
}

export function broadcastFromIsDedicated(): boolean {
  return Boolean(process.env.BROADCAST_FROM?.trim());
}

export function broadcastReplyTo(): string | undefined {
  return process.env.BROADCAST_REPLY_TO?.trim() || undefined;
}

export function unsubscribeLinks(address: string, broadcastId: string | null) {
  const token = encodeURIComponent(createUnsubscribeToken(address, broadcastId));
  return {
    page: `${PLATFORM_ORIGIN}/unsubscribe?t=${token}`,
    oneClick: `${PLATFORM_ORIGIN}/api/unsubscribe?t=${token}`,
  };
}

/**
 * One recipient's letter, headers included.
 *
 * `List-Unsubscribe` + `List-Unsubscribe-Post` is RFC 8058 one-click
 * unsubscribe. Gmail and Yahoo require it of bulk senders since 2024; without
 * it the campaign is filed as spam no matter how good the words are.
 */
export function buildRecipientEmail(
  content: BroadcastContent,
  recipient: { address: string; name: string | null },
  broadcastId: string | null,
): BatchEmail {
  const links = unsubscribeLinks(recipient.address, broadcastId);
  const rendered = renderBroadcastEmail(content, { name: recipient.name, unsubscribeUrl: links.page });
  return {
    to: recipient.address,
    from: broadcastFrom(),
    replyTo: broadcastReplyTo(),
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    headers: {
      "List-Unsubscribe": `<${links.oneClick}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

function broadcastIdFrom(payload: unknown): string {
  const id = (payload as { broadcast_id?: unknown } | null)?.broadcast_id;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("broadcast_job_invalid_payload");
  return id;
}

export async function enqueueBroadcastJob(broadcastId: string, runAt: Date): Promise<void> {
  const db = serviceClient();
  const { error } = await db.from("jobs").insert({
    type: BROADCAST_JOB_TYPE,
    payload: { broadcast_id: broadcastId },
    status: "pending",
    run_at: runAt.toISOString(),
  });
  if (error) throw new Error(`broadcast_enqueue_failed:${error.message}`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Outcome = {
  id: string;
  status: "sent" | "failed" | "pending";
  provider_id?: string | null;
  error_text?: string | null;
};

async function markResults(broadcastId: string, results: Outcome[]) {
  if (results.length === 0) return;
  const db = serviceClient();
  const { error } = await db.rpc("broadcast_mark_results", {
    p_broadcast_id: broadcastId,
    p_results: results.map((r) => ({
      id: r.id,
      status: r.status,
      provider_id: r.provider_id ?? null,
      error_text: r.error_text ?? null,
    })),
  });
  if (error) throw new Error(`broadcast_mark_failed:${error.message}`);
}

export type RunResult = "not_found" | "not_due" | "inactive" | "sent" | "continued" | "retry_later" | "failed";

export async function runBroadcastJob(payload: unknown, options: { budgetMs?: number } = {}): Promise<RunResult> {
  const broadcastId = broadcastIdFrom(payload);
  const deadline = Date.now() + (options.budgetMs ?? DEFAULT_BUDGET_MS);
  const db = serviceClient();

  const { data: broadcast, error } = await db.from("broadcasts").select("*").eq("id", broadcastId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!broadcast) return "not_found";

  if (broadcast.status === "scheduled") {
    // Rescheduled to later: that schedule queued its own job.
    if (broadcast.scheduled_at && Date.parse(broadcast.scheduled_at) > Date.now() + 30_000) return "not_due";
    const { data: moved, error: moveError } = await db
      .from("broadcasts")
      .update({
        status: "sending",
        started_at: new Date().toISOString(),
        error_text: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", broadcastId)
      .eq("status", "scheduled")
      .select("id")
      .maybeSingle();
    if (moveError) throw new Error(moveError.message);
    if (moved) {
      const { error: freezeError } = await db.rpc("broadcast_materialize", { p_broadcast_id: broadcastId });
      if (freezeError) throw new Error(`broadcast_materialize_failed:${freezeError.message}`);
    }
  } else if (broadcast.status !== "sending") {
    return "inactive";
  }

  const content: BroadcastContent = {
    subject: broadcast.subject,
    preheader: broadcast.preheader,
    body: broadcast.body,
    ctaLabel: broadcast.cta_label,
    ctaUrl: broadcast.cta_url,
  };

  while (Date.now() < deadline) {
    // Re-read each slice: «Скасувати» must stop a send in progress.
    const { data: current } = await db.from("broadcasts").select("status").eq("id", broadcastId).maybeSingle();
    if (current?.status !== "sending") return "inactive";

    const { data: batch, error: claimError } = await db.rpc("broadcast_claim_recipients", {
      p_broadcast_id: broadcastId,
      p_limit: RESEND_BATCH_MAX,
    });
    if (claimError) throw new Error(`broadcast_claim_failed:${claimError.message}`);
    const rows = batch ?? [];

    if (rows.length === 0) {
      return finalize(broadcastId);
    }

    let emails: BatchEmail[];
    try {
      emails = rows.map((row) => buildRecipientEmail(content, { address: row.address, name: row.name }, broadcastId));
    } catch (renderError) {
      await markResults(
        broadcastId,
        rows.map((row) => ({ id: row.id, status: "pending" })),
      );
      throw renderError;
    }

    const key = `broadcast-${broadcastId}-${createHash("sha256")
      .update(
        rows
          .map((row) => row.id)
          .sort()
          .join(","),
      )
      .digest("hex")
      .slice(0, 32)}`;
    const result = await sendEmailBatch(emails, key);

    if (result.sent) {
      await markResults(
        broadcastId,
        rows.map((row, index) => ({ id: row.id, status: "sent", provider_id: result.ids[index] })),
      );
    } else if (result.reason === "missing_api_key") {
      await markResults(
        broadcastId,
        rows.map((row) => ({ id: row.id, status: "pending" })),
      );
      await db
        .from("broadcasts")
        .update({
          status: "failed",
          error_text: "RESEND_API_KEY is not configured",
          updated_at: new Date().toISOString(),
        })
        .eq("id", broadcastId);
      return "failed";
    } else if (result.reason === "rate_limited" || result.reason === "network_error") {
      // Nobody's fault on the recipient's side: put the rows back and come back.
      await markResults(
        broadcastId,
        rows.map((row) => ({ id: row.id, status: "pending" })),
      );
      await enqueueBroadcastJob(broadcastId, new Date(Date.now() + RETRY_LATER_MS));
      return "retry_later";
    } else {
      // A batch is validated as a whole: one malformed address refuses all
      // hundred. Send this slice one by one so only that address fails.
      const outcomes: Outcome[] = [];
      for (const [index, row] of rows.entries()) {
        const email = emails[index];
        if (!email) continue;
        const single = await sendEmail({
          to: email.to,
          from: email.from,
          replyTo: email.replyTo,
          subject: email.subject,
          html: email.html,
          text: email.text,
          headers: email.headers,
          idempotencyKey: `broadcast-${broadcastId}-${row.id}`,
        });
        outcomes.push(
          single.sent
            ? { id: row.id, status: "sent", provider_id: single.id }
            : single.reason === "provider_error"
              ? { id: row.id, status: "failed", error_text: single.detail ?? single.reason }
              : { id: row.id, status: "pending" },
        );
        await sleep(220);
      }
      await markResults(broadcastId, outcomes);
      if (outcomes.some((o) => o.status === "pending")) {
        await enqueueBroadcastJob(broadcastId, new Date(Date.now() + RETRY_LATER_MS));
        return "retry_later";
      }
    }

    await sleep(PAUSE_BETWEEN_BATCHES_MS);
  }

  await enqueueBroadcastJob(broadcastId, new Date());
  return "continued";
}

async function finalize(broadcastId: string): Promise<RunResult> {
  const db = serviceClient();
  const { count, error } = await db
    .from("broadcast_recipients")
    .select("id", { count: "exact", head: true })
    .eq("broadcast_id", broadcastId)
    .in("status", ["pending", "sending"]);
  if (error) throw new Error(error.message);

  if ((count ?? 0) > 0) {
    // Another worker holds a claim. Look again after its claim could expire.
    await enqueueBroadcastJob(broadcastId, new Date(Date.now() + 2 * RETRY_LATER_MS));
    return "continued";
  }

  const now = new Date().toISOString();
  const { error: doneError } = await db
    .from("broadcasts")
    .update({ status: "sent", finished_at: now, updated_at: now })
    .eq("id", broadcastId)
    .eq("status", "sending");
  if (doneError) throw new Error(getErrorMessage(doneError));
  return "sent";
}
