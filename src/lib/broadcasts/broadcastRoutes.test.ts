/**
 * The gates on the broadcast routes: who may read, who may mail the base, and
 * what the public unsubscribe endpoint will and will not do.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const session = { value: null as null | { user: { id: string; email?: string }; role: string } };
const calls = { setStatus: [] as unknown[][], schedule: [] as unknown[][] };

vi.mock("@/lib/auth/requireAdmin", () => ({
  requireAdmin: async () => session.value,
}));

vi.mock("@/lib/broadcasts/subscriptions", async (importOriginal) => {
  const original = await importOriginal<typeof import("./subscriptions")>();
  return {
    ...original,
    setSubscriptionStatus: async (...args: unknown[]) => {
      calls.setStatus.push(args);
      return { changed: true, status: args[1] };
    },
    listSubscriptions: async () => ({ data: [], count: 0, totals: {} }),
  };
});

vi.mock("@/lib/broadcasts/server", async (importOriginal) => {
  const original = await importOriginal<typeof import("./server")>();
  return {
    ...original,
    scheduleBroadcast: async (...args: unknown[]) => {
      calls.schedule.push(args);
      return { broadcast: {}, recipients: 3, immediate: false };
    },
  };
});

process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

const unsubscribe = await import("@/app/api/unsubscribe/route");
const send = await import("@/app/api/admin/broadcasts/[id]/send/route");
const subscriptions = await import("@/app/api/admin/subscriptions/route");
const { createUnsubscribeToken } = await import("./unsubscribeToken");

const ID = "11111111-2222-3333-4444-555555555555";
const params = { params: Promise.resolve({ id: ID }) };

function json(url: string, body: unknown, method = "POST") {
  return new NextRequest(url, { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  session.value = null;
  calls.setStatus = [];
  calls.schedule = [];
});

describe("/api/unsubscribe", () => {
  it("never unsubscribes on GET — a link scanner must not empty the list", async () => {
    const token = createUnsubscribeToken("a@b.co", ID);
    const res = await unsubscribe.GET(
      new NextRequest(`http://localhost/api/unsubscribe?t=${encodeURIComponent(token)}`),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/unsubscribe?t=");
    expect(calls.setStatus).toHaveLength(0);
  });

  it("unsubscribes on one-click POST, only from subscribed", async () => {
    const token = createUnsubscribeToken("a@b.co", ID);
    const res = await unsubscribe.POST(
      new NextRequest(`http://localhost/api/unsubscribe?t=${encodeURIComponent(token)}`, {
        method: "POST",
        body: "List-Unsubscribe=One-Click",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }),
    );
    expect(res.status).toBe(200);
    expect(calls.setStatus).toEqual([
      ["a@b.co", "unsubscribed", expect.objectContaining({ broadcastId: ID, onlyFrom: ["subscribed"] })],
    ]);
  });

  it("resubscribes only an address that unsubscribed itself", async () => {
    const token = createUnsubscribeToken("a@b.co");
    await unsubscribe.POST(json("http://localhost/api/unsubscribe", { t: token, action: "resubscribe" }));
    expect(calls.setStatus).toEqual([
      ["a@b.co", "subscribed", expect.objectContaining({ onlyFrom: ["unsubscribed"] })],
    ]);
  });

  it("refuses a forged token", async () => {
    const res = await unsubscribe.POST(
      json("http://localhost/api/unsubscribe", { t: "u1.aaa.bbb.cccccccccccccccccccccccc" }),
    );
    expect(res.status).toBe(400);
    expect(calls.setStatus).toHaveLength(0);
  });
});

describe("POST /api/admin/broadcasts/[id]/send", () => {
  it("refuses anonymous and support", async () => {
    expect((await send.POST(json("http://localhost/x", {}), params)).status).toBe(401);
    session.value = { user: { id: "s" }, role: "support" };
    expect((await send.POST(json("http://localhost/x", {}), params)).status).toBe(403);
    expect(calls.schedule).toHaveLength(0);
  });

  it("refuses an unparseable time", async () => {
    session.value = { user: { id: "a" }, role: "admin" };
    const res = await send.POST(json("http://localhost/x", { at: "tomorrow-ish" }), params);
    expect(res.status).toBe(400);
  });

  it("schedules for an admin", async () => {
    session.value = { user: { id: "a" }, role: "admin" };
    const res = await send.POST(json("http://localhost/x", { at: "2030-01-01T10:00:00.000Z" }), params);
    expect(res.status).toBe(200);
    expect(calls.schedule[0]?.[0]).toBe(ID);
  });
});

describe("/api/admin/subscriptions", () => {
  it("lets support read but not import or change", async () => {
    session.value = { user: { id: "s" }, role: "support" };
    expect((await subscriptions.GET(new NextRequest("http://localhost/api/admin/subscriptions"))).status).toBe(200);
    expect((await subscriptions.POST(json("http://localhost/x", { csv: "a@b.co" }))).status).toBe(403);
    expect(
      (await subscriptions.PATCH(json("http://localhost/x", { address: "a@b.co", status: "unsubscribed" }, "PATCH")))
        .status,
    ).toBe(403);
  });

  it("previews an import without writing", async () => {
    session.value = { user: { id: "a" }, role: "admin" };
    const res = await subscriptions.POST(json("http://localhost/x", { csv: "email\na@b.co\nbad", dryRun: true }));
    expect(await res.json()).toMatchObject({ preview: { valid: 1, invalid: 1 } });
  });

  it("refuses a status outside the vocabulary", async () => {
    session.value = { user: { id: "a" }, role: "admin" };
    const res = await subscriptions.PATCH(
      json("http://localhost/x", { address: "a@b.co", status: "deleted" }, "PATCH"),
    );
    expect(res.status).toBe(400);
  });
});
