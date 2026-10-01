import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/server", () => ({ serviceClient: () => ({}) }));

const { verifySvixSignature } = await import("./resendWebhook");

const key = Buffer.from("super-secret-key-bytes");
const secret = `whsec_${key.toString("base64")}`;

function sign(id: string, ts: number, body: string) {
  return `v1,${createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64")}`;
}

describe("verifySvixSignature", () => {
  const body = JSON.stringify({ type: "email.delivered" });
  const now = 1_800_000_000;

  it("accepts a fresh, correctly signed body (among several signatures)", () => {
    const signature = `v1,AAAA ${sign("msg_1", now, body)}`;
    expect(verifySvixSignature(secret, { id: "msg_1", timestamp: String(now), signature }, body, now)).toBe(true);
  });

  it("refuses a changed body, a stale timestamp, a missing header", () => {
    const signature = sign("msg_1", now, body);
    expect(verifySvixSignature(secret, { id: "msg_1", timestamp: String(now), signature }, `${body} `, now)).toBe(
      false,
    );
    expect(verifySvixSignature(secret, { id: "msg_1", timestamp: String(now), signature }, body, now + 10 * 60)).toBe(
      false,
    );
    expect(verifySvixSignature(secret, { id: null, timestamp: String(now), signature }, body, now)).toBe(false);
  });
});
