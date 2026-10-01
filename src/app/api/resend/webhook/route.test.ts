import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const applyResendEvent = vi.fn();
vi.mock("@/lib/broadcasts/resendWebhook", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/broadcasts/resendWebhook")>();
  return { ...real, applyResendEvent };
});
vi.mock("@/lib/db/server", () => ({ serviceClient: () => ({}) }));

const { POST } = await import("./route");

const key = Buffer.from("k3y");
const body = JSON.stringify({ type: "email.bounced", data: { email_id: "p-1", bounce: { type: "Permanent" } } });

function req(signature?: string) {
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = signature ?? `v1,${createHmac("sha256", key).update(`m1.${ts}.${body}`).digest("base64")}`;
  return new NextRequest("https://www.centerway.net.ua/api/resend/webhook", {
    method: "POST",
    headers: { "svix-id": "m1", "svix-timestamp": ts, "svix-signature": sig },
    body,
  });
}

afterEach(() => {
  delete process.env.RESEND_WEBHOOK_SECRET;
  applyResendEvent.mockReset();
});

describe("POST /api/resend/webhook", () => {
  it("is closed until the secret is configured", async () => {
    expect((await POST(req())).status).toBe(503);
  });

  it("refuses a bad signature and applies a good one", async () => {
    process.env.RESEND_WEBHOOK_SECRET = `whsec_${key.toString("base64")}`;
    expect((await POST(req("v1,AAAA"))).status).toBe(401);
    expect(applyResendEvent).not.toHaveBeenCalled();
    applyResendEvent.mockResolvedValue({ applied: true });
    expect((await POST(req())).status).toBe(200);
    expect(applyResendEvent).toHaveBeenCalledWith(JSON.parse(body));
  });
});
