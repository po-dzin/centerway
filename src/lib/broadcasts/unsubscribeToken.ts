/**
 * The unsubscribe link's token: the address and the campaign, signed.
 *
 * WHY SIGNED AND NOT A ROW ID. The link must work without the recipient signing
 * in — a person who wants out of a list is not going to log in first — so the
 * link itself has to prove which address it speaks for. An unsigned
 * `?email=` would let anyone unsubscribe anyone; a recipient row id would stop
 * working the day the campaign's rows are pruned. An HMAC over the address
 * needs neither a row nor a session, and never expires, which is what the law
 * and the mailbox providers both expect of an unsubscribe link.
 *
 * THE KEY. `UNSUBSCRIBE_SECRET` when it is set; otherwise one derived from the
 * service-role key with a label, so the feature works on a deployment nobody
 * has added a variable to yet, and the derived key cannot be used for anything
 * but this. Rotating either invalidates links already in inboxes — set the
 * dedicated variable once and leave it.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export type UnsubscribeClaim = { address: string; broadcastId: string | null };

function secret(): string {
  const dedicated = process.env.UNSUBSCRIBE_SECRET?.trim();
  if (dedicated) return dedicated;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!service) throw new Error("unsubscribe_secret_missing");
  return createHmac("sha256", service).update("centerway:unsubscribe:v1").digest("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createUnsubscribeToken(claim: UnsubscribeClaim): string {
  const payload = Buffer.from(JSON.stringify({ a: claim.address, b: claim.broadcastId ?? null }), "utf8").toString(
    "base64url",
  );
  return `${payload}.${sign(payload)}`;
}

/** The claim a token carries, or null for anything forged, truncated or malformed. */
export function verifyUnsubscribeToken(token: string | null | undefined): UnsubscribeClaim | null {
  if (!token || typeof token !== "string" || token.length > 2000) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1), "base64url");
  const expected = Buffer.from(sign(payload), "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { a?: unknown; b?: unknown };
    if (typeof parsed.a !== "string" || !parsed.a.includes("@")) return null;
    return {
      address: parsed.a.trim().toLowerCase(),
      broadcastId: typeof parsed.b === "string" && parsed.b ? parsed.b : null,
    };
  } catch {
    return null;
  }
}
