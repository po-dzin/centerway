/**
 * The auto-reply rules over HTTP. Staff read; only the owner (`admin`) writes,
 * every write is audited, and a refusal from the library keeps its code and status.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireAdminSession = vi.fn();
const writeAudit = vi.fn();
const listRules = vi.fn();
const createRule = vi.fn();
const updateRule = vi.fn();
const deleteRule = vi.fn();
const listEvents = vi.fn();

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
vi.mock("@/lib/autoreply/rules", async () => {
  class AutoreplyError extends Error {
    constructor(
      readonly code: string,
      readonly status: number,
    ) {
      super(code);
      this.name = "AutoreplyError";
    }
  }
  return { AutoreplyError, listRules, createRule, updateRule, deleteRule, listEvents };
});

const list = await import("./route");
const one = await import("./[id]/route");
const { AutoreplyError } = await import("@/lib/autoreply/rules");

const admin = { user: { id: "u-admin" }, role: "admin" };
const support = { user: { id: "u-support" }, role: "support" };

const url = "https://www.centerway.net.ua/api/admin/autoreply";
const request = (method: string, body?: unknown, path = "") =>
  new NextRequest(url + path, {
    method,
    headers: { authorization: "Bearer t", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = { params: Promise.resolve({ id: "r1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminSession.mockResolvedValue(admin);
  delete process.env.INSTAGRAM_ACCESS_TOKEN;
});

describe("GET /api/admin/autoreply", () => {
  it("refuses a stranger", async () => {
    requireAdminSession.mockResolvedValue(null);
    expect((await list.GET(request("GET"))).status).toBe(401);
    expect(listRules).not.toHaveBeenCalled();
  });

  it("lets support read and reports whether Instagram is connected", async () => {
    requireAdminSession.mockResolvedValue(support);
    listRules.mockResolvedValue([]);
    const res = await list.GET(request("GET"));
    expect(await res.json()).toEqual({ rules: [], canEdit: false, connected: false });
    process.env.INSTAGRAM_ACCESS_TOKEN = "tok";
    requireAdminSession.mockResolvedValue(admin);
    expect(await (await list.GET(request("GET"))).json()).toMatchObject({ canEdit: true, connected: true });
  });
});

describe("POST /api/admin/autoreply", () => {
  it("refuses a stranger and a support session, writing nothing", async () => {
    requireAdminSession.mockResolvedValue(null);
    expect((await list.POST(request("POST", {}))).status).toBe(401);
    requireAdminSession.mockResolvedValue(support);
    expect((await list.POST(request("POST", {}))).status).toBe(403);
    expect(createRule).not.toHaveBeenCalled();
    expect(writeAudit).not.toHaveBeenCalled();
  });

  it("creates a rule for the owner and audits it", async () => {
    createRule.mockResolvedValue({ id: "r1", name: "ДОША" });
    const res = await list.POST(request("POST", { name: "ДОША" }));
    expect(res.status).toBe(201);
    expect(createRule).toHaveBeenCalledWith("u-admin", { name: "ДОША" });
    expect(writeAudit).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ actorId: "u-admin", action: "autoreply.create", entityId: "r1" }),
    );
  });

  it("keeps the code and status of a refusal and does not audit it", async () => {
    createRule.mockRejectedValue(new AutoreplyError("rule_needs_keywords", 422));
    const res = await list.POST(request("POST", {}));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: "rule_needs_keywords" });
    expect(writeAudit).not.toHaveBeenCalled();
  });
});

describe("/api/admin/autoreply/:id", () => {
  it("GET returns the journal to staff and refuses a stranger", async () => {
    listEvents.mockResolvedValue([{ id: "e1" }]);
    requireAdminSession.mockResolvedValue(support);
    expect(await (await one.GET(request("GET", undefined, "/r1"), ctx)).json()).toEqual({ events: [{ id: "e1" }] });
    requireAdminSession.mockResolvedValue(null);
    expect((await one.GET(request("GET", undefined, "/r1"), ctx)).status).toBe(401);
  });

  it("PATCH and DELETE refuse support and strangers, writing nothing", async () => {
    requireAdminSession.mockResolvedValue(support);
    expect((await one.PATCH(request("PATCH", { enabled: true }, "/r1"), ctx)).status).toBe(403);
    expect((await one.DELETE(request("DELETE", undefined, "/r1"), ctx)).status).toBe(403);
    requireAdminSession.mockResolvedValue(null);
    expect((await one.PATCH(request("PATCH", {}, "/r1"), ctx)).status).toBe(401);
    expect((await one.DELETE(request("DELETE", undefined, "/r1"), ctx)).status).toBe(401);
    expect(updateRule).not.toHaveBeenCalled();
    expect(deleteRule).not.toHaveBeenCalled();
    expect(writeAudit).not.toHaveBeenCalled();
  });

  it("PATCH updates and audits; a refusal keeps its code", async () => {
    updateRule.mockResolvedValue({ id: "r1", enabled: true });
    const ok = await one.PATCH(request("PATCH", { enabled: true }, "/r1"), ctx);
    expect(ok.status).toBe(200);
    expect(updateRule).toHaveBeenCalledWith("r1", { enabled: true });
    expect(writeAudit).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ action: "autoreply.update", entityId: "r1" }),
    );

    writeAudit.mockClear();
    updateRule.mockRejectedValue(new AutoreplyError("rule_needs_message", 422));
    const refused = await one.PATCH(request("PATCH", { enabled: true }, "/r1"), ctx);
    expect(refused.status).toBe(422);
    expect(writeAudit).not.toHaveBeenCalled();
  });

  it("DELETE removes the rule and audits it", async () => {
    deleteRule.mockResolvedValue(undefined);
    const res = await one.DELETE(request("DELETE", undefined, "/r1"), ctx);
    expect(await res.json()).toEqual({ ok: true });
    expect(deleteRule).toHaveBeenCalledWith("r1");
    expect(writeAudit).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ action: "autoreply.delete", entityId: "r1" }),
    );
  });
});
