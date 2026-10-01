/**
 * The campaign's lifecycle endpoint. Guarded: only the owner (`admin`) acts,
 * support reads; a start carries the confirmed number or is refused before
 * anything is frozen; a test goes to the operator's own address by default.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireAdminSession = vi.fn();
const lib = {
  getBroadcast: vi.fn(),
  updateDraft: vi.fn(),
  deleteDraft: vi.fn(),
  sendTest: vi.fn(),
  startBroadcast: vi.fn(),
  sendNextBatch: vi.fn(),
  cancelBroadcast: vi.fn(),
  retryFailed: vi.fn(),
  duplicateBroadcast: vi.fn(),
};

vi.mock("@/lib/api/adminRoute", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireAdminSession,
    unauthorizedResponse: () => NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    forbiddenResponse: () => NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    badRequestResponse: (error: string) => NextResponse.json({ error }, { status: 400 }),
  };
});
vi.mock("@/lib/db/server", () => ({ serviceClient: () => ({}) }));
vi.mock("@/lib/admin/access/shared", () => ({ writeAudit: vi.fn() }));
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

const { GET, POST } = await import("./route");
const { BroadcastError } = await import("@/lib/broadcasts/server");

const ID = "11111111-2222-4333-8444-555555555555";
const ctx = (id = ID) => ({ params: Promise.resolve({ id }) });
const admin = { user: { id: "u-admin", email: "owner@example.com", user_metadata: { full_name: "G" } }, role: "admin" };
const support = { user: { id: "u-support", email: "s@example.com" }, role: "support" };

function post(body: unknown, id = ID) {
  return POST(
    new NextRequest(`https://www.centerway.net.ua/api/admin/broadcasts/${id}`, {
      method: "POST",
      headers: { authorization: "Bearer t", "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    ctx(id),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminSession.mockResolvedValue(admin);
});

describe("POST /api/admin/broadcasts/:id", () => {
  it("refuses a stranger and a support session", async () => {
    requireAdminSession.mockResolvedValue(null);
    expect((await post({ action: "continue" })).status).toBe(401);
    requireAdminSession.mockResolvedValue(support);
    expect((await post({ action: "continue" })).status).toBe(403);
    expect(lib.sendNextBatch).not.toHaveBeenCalled();
  });

  it("refuses a malformed id and an unknown action", async () => {
    expect((await post({ action: "continue" }, "nope")).status).toBe(400);
    expect((await post({ action: "nuke" })).status).toBe(400);
  });

  it("will not start without the confirmed number", async () => {
    expect((await post({ action: "start" })).status).toBe(400);
    expect((await post({ action: "start", confirmCount: 0 })).status).toBe(400);
    expect(lib.startBroadcast).not.toHaveBeenCalled();
  });

  it("passes the confirmed number through and reports a changed audience with its new count", async () => {
    lib.startBroadcast.mockRejectedValue(new BroadcastError("audience_changed", 409, { count: 272 }));
    const res = await post({ action: "start", confirmCount: 271 });
    expect(lib.startBroadcast).toHaveBeenCalledWith(ID, 271);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "audience_changed", count: 272 });
  });

  it("sends a test to the operator's own address by default", async () => {
    lib.sendTest.mockResolvedValue({ id: "p-1" });
    const res = await post({ action: "test" });
    expect(lib.sendTest).toHaveBeenCalledWith(ID, "owner@example.com", "G");
    expect(await res.json()).toMatchObject({ ok: true, to: "owner@example.com" });
  });
});

describe("GET /api/admin/broadcasts/:id", () => {
  it("lets support read, and says it cannot edit", async () => {
    requireAdminSession.mockResolvedValue(support);
    lib.getBroadcast.mockResolvedValue({ id: ID });
    const res = await GET(new NextRequest(`https://x/api/admin/broadcasts/${ID}`), ctx());
    expect(await res.json()).toEqual({ broadcast: { id: ID }, canEdit: false });
  });
});
