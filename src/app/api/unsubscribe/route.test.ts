/**
 * The way out. GET must never unsubscribe (link scanners fetch every URL in a
 * message); POST does, from the page's button and from the mailbox's one-click.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const setSubscriptionStatus = vi.fn();
vi.mock("@/lib/broadcasts/server", () => ({ setSubscriptionStatus }));

process.env.UNSUBSCRIBE_SECRET = "s";
const { GET, POST } = await import("./route");
const { createUnsubscribeToken } = await import("@/lib/broadcasts/unsubscribeToken");

const token = createUnsubscribeToken({ address: "olena@example.com", broadcastId: "b-1" });
const url = (t = token) => `https://www.centerway.net.ua/api/unsubscribe?t=${encodeURIComponent(t)}`;

beforeEach(() => setSubscriptionStatus.mockReset());

describe("/api/unsubscribe", () => {
  it("GET shows the address and a button, and changes nothing", async () => {
    const res = await GET(new NextRequest(url()));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("olena@example.com");
    expect(setSubscriptionStatus).not.toHaveBeenCalled();
  });

  it("POST from the page unsubscribes the signed address, with the campaign", async () => {
    const res = await POST(new NextRequest(url(), { method: "POST", body: "" }));
    expect(res.status).toBe(200);
    expect(setSubscriptionStatus).toHaveBeenCalledWith("olena@example.com", "unsubscribed", {
      source: "unsubscribe_link",
      reason: "unsubscribe_link",
      broadcastId: "b-1",
    });
  });

  it("POST one-click answers with an empty 200", async () => {
    const res = await POST(
      new NextRequest(url(), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
    expect(setSubscriptionStatus.mock.calls[0]![2]).toMatchObject({ reason: "one_click" });
  });

  it("a forged token unsubscribes nobody", async () => {
    const res = await POST(new NextRequest(url(`${token}x`), { method: "POST", body: "" }));
    expect(res.status).toBe(400);
    expect(setSubscriptionStatus).not.toHaveBeenCalled();
  });
});
