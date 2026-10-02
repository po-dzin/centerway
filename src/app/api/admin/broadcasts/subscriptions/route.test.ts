/**
 * The list's writes. The owner imports; support may unsubscribe someone by
 * hand but not put anyone back; the import's source is one of two known
 * values whatever the body says. (That an import never resubscribes a
 * suppressed address is the library's `ignoreDuplicates` upsert.)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireAdminSession = vi.fn();
const lib = {
  importSubscriptions: vi.fn(),
  listSubscriptions: vi.fn(),
  resubscribeManually: vi.fn(),
  setSubscriptionStatus: vi.fn(),
  subscriptionCounts: vi.fn(),
};
const writeAudit = vi.fn();

vi.mock("@/lib/api/adminRoute", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireAdminSession,
    unauthorizedResponse: () => NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    forbiddenResponse: () => NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    badRequestResponse: (error: string) => NextResponse.json({ error }, { status: 400 }),
    parseLimitOffset: () => ({ limit: 50, offset: 0 }),
  };
});
vi.mock("@/lib/db/server", () => ({ serviceClient: () => ({}) }));
vi.mock("@/lib/admin/access/shared", () => ({ writeAudit }));
vi.mock("@/lib/broadcasts/server", () => {
  class BroadcastError extends Error {
    constructor(
      readonly code: string,
      readonly status = 400,
      readonly extra: Record<string, unknown> = {},
    ) {
      super(code);
    }
  }
  return { BroadcastError, ...lib };
});

const { GET, POST, PATCH } = await import("./route");
const { BroadcastError } = await import("@/lib/broadcasts/server");

const URL = "https://www.centerway.net.ua/api/admin/broadcasts/subscriptions";
const admin = { user: { id: "u-admin" }, role: "admin" };
const support = { user: { id: "u-support" }, role: "support" };

const send = (method: "POST" | "PATCH", body: unknown) =>
  (method === "POST" ? POST : PATCH)(
    new NextRequest(URL, {
      method,
      headers: { authorization: "Bearer t", "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminSession.mockResolvedValue(admin);
});

describe("POST (import)", () => {
  it("is the owner's: a stranger gets 401, support 403", async () => {
    requireAdminSession.mockResolvedValue(null);
    expect((await send("POST", { text: "a@b.co" })).status).toBe(401);
    requireAdminSession.mockResolvedValue(support);
    expect((await send("POST", { text: "a@b.co" })).status).toBe(403);
    expect(lib.importSubscriptions).not.toHaveBeenCalled();
  });

  it("refuses an empty paste", async () => {
    expect((await send("POST", { text: "  " })).status).toBe(400);
  });

  it("imports with a known source only, and audits the result", async () => {
    lib.importSubscriptions.mockResolvedValue({ added: 1, existing: 2, invalid: [] });
    await send("POST", { text: "a@b.co", source: "anything_else" });
    expect(lib.importSubscriptions).toHaveBeenCalledWith("a@b.co", "csv_import");
    await send("POST", { text: "a@b.co", source: "sendpulse_import" });
    expect(lib.importSubscriptions).toHaveBeenLastCalledWith("a@b.co", "sendpulse_import");
    expect(writeAudit).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        action: "broadcast.subscriptions_import",
        metadata: expect.objectContaining({ added: 1 }),
      }),
    );
  });
});

describe("PATCH (one address)", () => {
  it("lets support unsubscribe someone by hand", async () => {
    requireAdminSession.mockResolvedValue(support);
    const res = await send("PATCH", { address: " Olena@Example.com ", action: "unsubscribe" });
    expect(res.status).toBe(200);
    expect(lib.setSubscriptionStatus).toHaveBeenCalledWith("olena@example.com", "unsubscribed", {
      source: "manual",
      reason: "manual",
      broadcastId: null,
    });
  });

  it("does not let support put anyone back", async () => {
    requireAdminSession.mockResolvedValue(support);
    expect((await send("PATCH", { address: "a@b.co", action: "resubscribe" })).status).toBe(403);
    expect(lib.resubscribeManually).not.toHaveBeenCalled();
  });

  it("passes the library's refusal of a resubscribe through", async () => {
    lib.resubscribeManually.mockRejectedValue(new BroadcastError("resubscribe_not_allowed", 409));
    const res = await send("PATCH", { address: "a@b.co", action: "resubscribe" });
    expect(res.status).toBe(409);
    expect(writeAudit).not.toHaveBeenCalled();
  });

  it("refuses an unknown action and a non-address", async () => {
    expect((await send("PATCH", { address: "a@b.co", action: "delete" })).status).toBe(400);
    expect((await send("PATCH", { address: "nope", action: "unsubscribe" })).status).toBe(400);
  });
});

describe("GET", () => {
  it("tells the panel whether the session may import", async () => {
    requireAdminSession.mockResolvedValue(support);
    lib.listSubscriptions.mockResolvedValue({ data: [], count: 0 });
    lib.subscriptionCounts.mockResolvedValue({});
    const res = await GET(new NextRequest(URL));
    expect(await res.json()).toMatchObject({ canEdit: false });
  });
});
