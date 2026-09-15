/**
 * Resend signs its webhooks the Svix way. Verified here with `node:crypto`
 * rather than the `svix` package, for the same reason `resend.ts` has no SDK:
 * it is one HMAC, and a dependency would be a second way to describe it.
 *
 *   signed content  `${svix-id}.${svix-timestamp}.${raw body}`
 *   key             base64 decode of the secret after its `whsec_` prefix
 *   header          `svix-signature: v1,<base64> v1,<base64> …` (several during rotation)
 *
 * THE RAW BODY, byte for byte. Parsing and re-serialising the JSON first
 * changes whitespace and key order, and the signature stops matching — which
 * would read as an attack on every legitimate event.
 *
 * The timestamp window stops a captured request from being replayed later.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SECONDS = 5 * 60;

export type ResendWebhookHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

export function verifyResendWebhook(input: {
  rawBody: string;
  headers: ResendWebhookHeaders;
  secret: string;
  nowSeconds?: number;
}): boolean {
  const { id, timestamp, signature } = input.headers;
  if (!id || !timestamp || !signature || !input.secret) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TOLERANCE_SECONDS) return false;

  const secret = input.secret.startsWith("whsec_") ? input.secret.slice("whsec_".length) : input.secret;
  const expected = createHmac("sha256", Buffer.from(secret, "base64"))
    .update(`${id}.${timestamp}.${input.rawBody}`)
    .digest();

  return signature.split(" ").some((entry) => {
    const [version, value] = entry.split(",", 2);
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** The part of a Resend event this app acts on. Everything else is ignored. */
export type ResendEmailEvent = {
  type: string;
  emailId: string | null;
  to: string[];
  bounceType: string | null;
};

export function parseResendEvent(body: unknown): ResendEmailEvent | null {
  if (!body || typeof body !== "object") return null;
  const event = body as { type?: unknown; data?: Record<string, unknown> };
  if (typeof event.type !== "string") return null;
  const data = event.data ?? {};
  const to = Array.isArray(data.to) ? data.to.filter((v): v is string => typeof v === "string") : [];
  const bounce = data.bounce && typeof data.bounce === "object" ? (data.bounce as Record<string, unknown>) : null;
  return {
    type: event.type,
    emailId: typeof data.email_id === "string" ? data.email_id : null,
    to,
    bounceType: typeof bounce?.type === "string" ? bounce.type : null,
  };
}
