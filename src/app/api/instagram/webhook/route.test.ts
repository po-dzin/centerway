import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { signBody } from "@/lib/autoreply/instagram";

vi.mock("@/lib/autoreply/store", () => ({ dbStore: () => ({}) }));
vi.mock("@/lib/autoreply/engine", () => ({
  handleComment: vi.fn(async () => ({ outcome: "no_rule" })),
  handlePostback: vi.fn(async () => ({ outcome: "ignored" })),
}));

import { GET, POST } from "./route";

const body = JSON.stringify({ object: "instagram", entry: [] });

function post(signature: string | null) {
  return new NextRequest("https://example.test/api/instagram/webhook", {
    method: "POST",
    headers: signature ? { "x-hub-signature-256": signature } : {},
    body,
  });
}

afterEach(() => vi.unstubAllEnvs());

describe("instagram webhook", () => {
  it("answers the handshake only with our verify token", async () => {
    vi.stubEnv("INSTAGRAM_WEBHOOK_VERIFY_TOKEN", " tok ");
    const ok = await GET(
      new NextRequest(
        "https://example.test/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=tok&hub.challenge=42",
      ),
    );
    expect(await ok.text()).toBe("42");
    const bad = await GET(
      new NextRequest(
        "https://example.test/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=no&hub.challenge=42",
      ),
    );
    expect(bad.status).toBe(403);
  });

  it("accepts a delivery signed with either configured app secret", async () => {
    vi.stubEnv("INSTAGRAM_APP_SECRET", "ig-secret");
    vi.stubEnv("META_APP_SECRET", "meta-secret");
    expect((await POST(post(signBody("ig-secret", body)))).status).toBe(200);
    expect((await POST(post(signBody("meta-secret", body)))).status).toBe(200);
  });

  it("refuses an unsigned or wrongly signed delivery", async () => {
    vi.stubEnv("INSTAGRAM_APP_SECRET", "ig-secret");
    expect((await POST(post(null))).status).toBe(401);
    expect((await POST(post(signBody("other", body)))).status).toBe(401);
  });

  it("is not configured without any secret", async () => {
    vi.stubEnv("INSTAGRAM_APP_SECRET", "");
    vi.stubEnv("META_APP_SECRET", "");
    expect((await POST(post(null))).status).toBe(503);
  });
});
