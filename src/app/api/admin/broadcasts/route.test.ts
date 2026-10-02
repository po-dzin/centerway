/**
 * Creating a campaign. Only the owner (`admin`) writes one, every creation is
 * audited, and a refusal from the library keeps its code and status.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireAdminSession = vi.fn();
const createBroadcast = vi.fn();
const listBroadcasts = vi.fn();
const writeAudit = vi.fn();

vi.mock("@/lib/api/adminRoute", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireAdminSession,
    unauthorizedResponse: () => NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    forbiddenResponse: () => NextResponse.json({ error: "Forbidden" }, { status: 403 }),
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
  return { BroadcastError, createBroadcast, listBroadcasts };
});

const { GET, POST } = await import("./route");
const { BroadcastError } = await import("@/lib/broadcasts/server");

const admin = { user: { id: "u-admin" }, role: "admin" };
const support = { user: { id: "u-support" }, role: "support" };

function post(body: unknown) {
  return POST(
    new NextRequest("https://www.centerway.net.ua/api/admin/broadcasts", {
      method: "POST",
      headers: { authorization: "Bearer t", "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminSession.mockResolvedValue(admin);
});

describe("POST /api/admin/broadcasts", () => {
  it("refuses a stranger and a support session, writing nothing", async () => {
    requireAdminSession.mockResolvedValue(null);
    expect((await post({ title: "x" })).status).toBe(401);
    requireAdminSession.mockResolvedValue(support);
    expect((await post({ title: "x" })).status).toBe(403);
    expect(createBroadcast).not.toHaveBeenCalled();
    expect(writeAudit).not.toHaveBeenCalled();
  });

  it("creates the draft as the admin and audits it", async () => {
    createBroadcast.mockResolvedValue({ id: "b-1", title: "Анонс" });
    const res = await post({ title: "Анонс" });
    expect(res.status).toBe(201);
    expect(createBroadcast).toHaveBeenCalledWith("u-admin", { title: "Анонс" });
    expect(writeAudit).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ actorId: "u-admin", action: "broadcast.create", entityId: "b-1" }),
    );
  });

  it("passes a refusal through with its code", async () => {
    createBroadcast.mockRejectedValue(new BroadcastError("ctaUrl_invalid"));
    const res = await post({ ctaUrl: "javascript:x" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "ctaUrl_invalid" });
    expect(writeAudit).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/broadcasts", () => {
  it("lets support read and says it cannot edit", async () => {
    requireAdminSession.mockResolvedValue(support);
    listBroadcasts.mockResolvedValue([]);
    const res = await GET(new NextRequest("https://x/api/admin/broadcasts"));
    expect(await res.json()).toEqual({ broadcasts: [], canEdit: false });
  });
});
