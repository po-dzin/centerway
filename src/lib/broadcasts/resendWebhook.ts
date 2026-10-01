/**
 * What the provider tells us after a message left: delivered, opened, clicked,
 * bounced, complained.
 *
 * Resend signs its webhooks the Svix way: HMAC-SHA256 over
 * `${svix-id}.${svix-timestamp}.${raw body}` with the base64 part of the
 * `whsec_…` secret, sent as one or more `v1,<base64>` in `svix-signature`.
 * Verified here with `node:crypto` rather than the `svix` package, for the
 * same reason `resend.ts` has no SDK.
 *
 * TWO JOBS, AND THE SECOND IS THE ONE THAT MATTERS.
 *   1. The campaign's stats: a timestamp on the recipient row the event names.
 *   2. Suppression: a hard bounce or a spam complaint puts the ADDRESS on the
 *      suppression list, whichever message caused it — a receipt that bounced
 *      is as good a reason not to mail a launch to that address as a broadcast.
 *      Mailing people who complained is what gets a sending domain blocked.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import { serviceClient } from "@/lib/db/server";
import { setSubscriptionStatus } from "./server";

type Db = ReturnType<typeof serviceClient>;

/** Five minutes either side, as Svix recommends: a replayed body with an old timestamp is refused. */
const TOLERANCE_SECONDS = 5 * 60;

export function verifySvixSignature(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  body: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret, "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();

  for (const part of signature.split(" ")) {
    const [version, value] = part.split(",", 2);
    if (version !== "v1" || !value) continue;
    const given = Buffer.from(value, "base64");
    if (given.length === expected.length && timingSafeEqual(given, expected)) return true;
  }
  return false;
}

export type ResendEvent = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    bounce?: { type?: string };
  };
};

const COLUMN_BY_TYPE = {
  "email.delivered": "delivered_at",
  "email.opened": "opened_at",
  "email.clicked": "clicked_at",
  "email.bounced": "bounced_at",
  "email.complained": "complained_at",
} as const;

export async function applyResendEvent(event: ResendEvent, db: Db = serviceClient()): Promise<{ applied: boolean }> {
  const type = event.type ?? "";
  const column = COLUMN_BY_TYPE[type as keyof typeof COLUMN_BY_TYPE];
  if (!column) return { applied: false };

  const emailId = event.data?.email_id ?? null;
  const at =
    event.created_at && !Number.isNaN(Date.parse(event.created_at)) ? event.created_at : new Date().toISOString();

  let broadcastId: string | null = null;
  let recipientAddress: string | null = null;
  if (emailId) {
    // First event of its kind wins: a second open does not move the first.
    const { data, error } = await db
      .from("broadcast_recipients")
      .update({ [column]: at } as Partial<Record<(typeof COLUMN_BY_TYPE)[keyof typeof COLUMN_BY_TYPE], string>>)
      .eq("provider_id", emailId)
      .is(column, null)
      .select("broadcast_id, address");
    if (error) throw new Error(error.message);
    if (data?.[0]) {
      broadcastId = data[0].broadcast_id;
      recipientAddress = data[0].address;
    } else {
      const { data: known } = await db
        .from("broadcast_recipients")
        .select("broadcast_id, address")
        .eq("provider_id", emailId)
        .maybeSingle();
      broadcastId = known?.broadcast_id ?? null;
      recipientAddress = known?.address ?? null;
    }
  }

  const to = event.data?.to;
  const address = recipientAddress ?? (Array.isArray(to) ? to[0] : to) ?? null;

  if (address && type === "email.complained") {
    await setSubscriptionStatus(
      address,
      "complained",
      { source: "resend_webhook", reason: "complaint", broadcastId },
      db,
    );
  }
  // A transient bounce (mailbox full, greylisting) is not a reason to drop someone.
  if (address && type === "email.bounced" && (event.data?.bounce?.type ?? "").toLowerCase() !== "transient") {
    await setSubscriptionStatus(
      address,
      "bounced",
      { source: "resend_webhook", reason: `bounce:${event.data?.bounce?.type ?? "unknown"}`, broadcastId },
      db,
    );
  }

  return { applied: true };
}
