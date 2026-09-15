/**
 * The token behind every «Відписатися» link.
 *
 * SIGNED, NOT STORED, AND IT NEVER EXPIRES. An unsubscribe link has to work on
 * the day someone finds a two-year-old letter in their inbox; a table of issued
 * tokens would need to keep every one forever to promise that, and would hold
 * nothing the token cannot carry itself: this address, optionally this campaign.
 *
 * Replay is harmless by construction — the only thing a token can do is take
 * its own address off the list, which is what its holder asked for.
 *
 * THE SECRET. `BROADCAST_LINK_SECRET` when set. Otherwise a key DERIVED from the
 * service-role key with a fixed label, so the feature works without new config
 * and the service key itself never signs anything in the open. Rotating the
 * service key therefore invalidates old links — set the dedicated secret before
 * that day comes.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const VERSION = "u1";
const SIGNATURE_CHARS = 24;

function key(): Buffer {
  const dedicated = process.env.BROADCAST_LINK_SECRET;
  if (dedicated) return Buffer.from(dedicated);
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("broadcast_link_secret_missing");
  return createHmac("sha256", serviceKey).update("cw-broadcast-unsubscribe-v1").digest();
}

function b64url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function unb64url(value: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(body: string): string {
  return createHmac("sha256", key()).update(body).digest("hex").slice(0, SIGNATURE_CHARS);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** `u1.<address>.<broadcastId|"">.<signature>`, every part URL-safe. */
export function createUnsubscribeToken(address: string, broadcastId?: string | null): string {
  const body = `${VERSION}.${b64url(normalizeEmail(address))}.${b64url(broadcastId ?? "")}`;
  return `${body}.${sign(body)}`;
}

export type UnsubscribeVerdict =
  { ok: true; address: string; broadcastId: string | null } | { ok: false; reason: "malformed" | "bad_signature" };

export function verifyUnsubscribeToken(token: string | null | undefined): UnsubscribeVerdict {
  const parts = (token ?? "").split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) return { ok: false, reason: "malformed" };
  const [version = "", rawAddress = "", rawBroadcast = "", signature = ""] = parts;
  if (signature.length !== SIGNATURE_CHARS) return { ok: false, reason: "malformed" };

  const expected = Buffer.from(sign(`${version}.${rawAddress}.${rawBroadcast}`));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "bad_signature" };
  }

  const address = unb64url(rawAddress);
  const broadcastId = unb64url(rawBroadcast);
  if (!address || !address.includes("@") || broadcastId === null) return { ok: false, reason: "malformed" };
  return { ok: true, address, broadcastId: broadcastId || null };
}
