import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const handleComment = vi.fn(async () => ({ outcome: "sent", ruleId: "r1" }));
vi.mock("@/lib/autoreply/engine", () => ({ handleComment }));
vi.mock("@/lib/autoreply/store", () => ({ dbStore: () => ({}) }));

const { GET, POST } = await import("./route");
const { signBody } = await import("@/lib/autoreply/instagram");

const payload = JSON.stringify({
  object: "instagram",
  entry: [
    {
      id: "ACC",
      time: 1,
      changes: [{ field: "comments", value: { id: "c1", text: "доша", from: { id: "U1" }, media: { id: "M1" } } }],
    },
  ],
});

function post(body: string, signature: string | null) {
  return new NextRequest("https://www.centerway.net.ua/api/instagram/webhook", {
    method: "POST",
    body,
    headers: signature ? { "x-hub-signature-256": signature } : {},
  });
}

beforeEach(() => {
  handleComment.mockClear();
  process.env.META_APP_SECRET = "s3cret";
  process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN = "verify-me";
  delete process.env.INSTAGRAM_APP_SECRET;
});

describe("GET (handshake)", () => {
  const url = (token: string, mode = "subscribe") =>
    new NextRequest(
      `https://www.centerway.net.ua/api/instagram/webhook?hub.mode=${mode}&hub.verify_token=${token}&hub.challenge=12345`,
    );

  it("echoes the challenge for our verify token", async () => {
    const res = await GET(url("verify-me"));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("12345");
  });

  it("refuses a wrong token", async () => {
    expect((await GET(url("nope"))).status).toBe(403);
  });
});

describe("POST", () => {
  it("handles a correctly signed comment", async () => {
    const res = await POST(post(payload, signBody("s3cret", payload)));
    expect(res.status).toBe(200);
    expect(handleComment).toHaveBeenCalledTimes(1);
  });

  it("refuses a bad or missing signature without handling anything", async () => {
    expect((await POST(post(payload, signBody("wrong", payload)))).status).toBe(401);
    expect((await POST(post(payload, null))).status).toBe(401);
    expect(handleComment).not.toHaveBeenCalled();
  });

  it("refuses everything while the app secret is not set", async () => {
    delete process.env.META_APP_SECRET;
    expect((await POST(post(payload, signBody("s3cret", payload)))).status).toBe(503);
  });

  it("answers 500 when handling fails, so Meta delivers again", async () => {
    handleComment.mockRejectedValueOnce(new Error("db down"));
    expect((await POST(post(payload, signBody("s3cret", payload)))).status).toBe(500);
  });
});
