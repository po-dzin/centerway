/**
 * The owner's review of formats (2026-09-25).
 *
 * A price is the owner's (creator contract, 2026-08-22), so this suite guards
 * that only an admin session decides — support may read the list, never
 * approve — that what the admin typed reaches `reviewFormat` as the decision
 * it meant (an empty price is "no price", a non-integer is refused here), and
 * that a decision purges every cache a buyer reads prices through: a withdrawal
 * that stays cached keeps selling.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const listFormatsForReview = vi.fn();
const reviewFormat = vi.fn();
const revalidateTag = vi.fn();
const requireAdminSession = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidateTag, unstable_cache: (fn: () => unknown) => fn }));
vi.mock("@/lib/lms/liveCatalog", () => ({
  COURSE_LIST_TAG: "lms-courses",
  PURGE: { expire: 0 },
  courseTag: (slug: string) => `lms-course:${slug}`,
}));
vi.mock("@/lib/platform/productOffers", () => ({ PRODUCT_OFFERS_TAG: "product-offers" }));
vi.mock("@/lib/api/adminRoute", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireAdminSession,
    unauthorizedResponse: () => NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    forbiddenResponse: () => NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    badRequestResponse: (error: string) => NextResponse.json({ error }, { status: 400 }),
    serverErrorResponse: (error: string) => NextResponse.json({ error }, { status: 500 }),
  };
});
vi.mock("@/lib/experiences/formatAuthoring", () => {
  class FormatError extends Error {
    constructor(
      public readonly code: string,
      public readonly status = 400,
    ) {
      super(code);
    }
  }
  return { FormatError, listFormatsForReview, reviewFormat };
});

const { GET, PATCH } = await import("./route");
const { FormatError } = await import("@/lib/experiences/formatAuthoring");

const URL = "https://www.centerway.net.ua/api/admin/offer-formats";
const adminSession = { user: { id: "u-admin" }, role: "admin" };
const supportSession = { user: { id: "u-support" }, role: "support" };

function patch(body: unknown) {
  return PATCH(
    new NextRequest(URL, {
      method: "PATCH",
      headers: { authorization: "Bearer t", "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

function get() {
  return GET(new NextRequest(URL, { headers: { authorization: "Bearer t" } }));
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminSession.mockResolvedValue(adminSession);
  reviewFormat.mockResolvedValue({ courseSlug: "way21" });
});

describe("GET", () => {
  it("refuses a caller who is not staff", async () => {
    requireAdminSession.mockResolvedValue(null);
    const res = await get();
    expect(res.status).toBe(401);
    expect(listFormatsForReview).not.toHaveBeenCalled();
  });

  it("lists formats and says whether the reader may decide", async () => {
    listFormatsForReview.mockResolvedValue([{ code: "way21-group" }]);
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ formats: [{ code: "way21-group" }], canEdit: true });

    requireAdminSession.mockResolvedValue(supportSession);
    expect((await (await get()).json()).canEdit).toBe(false);
  });

  it("keeps a FormatError's code and status, and turns anything else into a 500", async () => {
    listFormatsForReview.mockRejectedValueOnce(new FormatError("format_read_failed:x", 500));
    const first = await get();
    expect(first.status).toBe(500);
    expect(await first.json()).toEqual({ error: "format_read_failed:x" });

    listFormatsForReview.mockRejectedValueOnce(new Error("socket"));
    const second = await get();
    expect(second.status).toBe(500);
    expect(await second.json()).toEqual({ error: "socket" });
  });
});

describe("PATCH", () => {
  it("refuses a caller who is not staff", async () => {
    requireAdminSession.mockResolvedValue(null);
    const res = await patch({ code: "way21-group", action: "approve", amount: 100 });
    expect(res.status).toBe(401);
    expect(reviewFormat).not.toHaveBeenCalled();
  });

  it("refuses support — a price is the owner's", async () => {
    requireAdminSession.mockResolvedValue(supportSession);
    const res = await patch({ code: "way21-group", action: "approve", amount: 100 });
    expect(res.status).toBe(403);
    expect(reviewFormat).not.toHaveBeenCalled();
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("requires a code", async () => {
    for (const body of [{ action: "decline" }, { code: "", action: "decline" }, "{broken"]) {
      const res = await patch(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "format_code_required" });
    }
    expect(reviewFormat).not.toHaveBeenCalled();
  });

  it("refuses an unknown action", async () => {
    const res = await patch({ code: "way21-group", action: "delete" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "format_invalid_action" });
    expect(reviewFormat).not.toHaveBeenCalled();
  });

  it("approves with the typed price and list price, as the session's user", async () => {
    const res = await patch({ code: "way21-group", action: "approve", amount: "4800", listAmount: 6000 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(reviewFormat).toHaveBeenCalledWith({
      code: "way21-group",
      actorId: "u-admin",
      decision: { action: "approve", amount: 4800, listAmount: 6000 },
    });
  });

  it("saves approved commercial terms through the admin-only route", async () => {
    const res = await patch({
      code: "way21-support",
      courseSlug: "way21",
      action: "save",
      amount: "9000",
      listAmount: null,
      mode: "lead",
      accessDays: "90",
      accessLifetime: false,
    });
    expect(res.status).toBe(200);
    expect(reviewFormat).toHaveBeenCalledWith({
      code: "way21-support",
      actorId: "u-admin",
      decision: { action: "save", amount: 9000, listAmount: null, mode: "lead", accessDays: 90, accessLifetime: false },
    });
    expect(revalidateTag).toHaveBeenCalledWith("lms-course:way21", { expire: 0 });
  });
  it("rejects invalid save mode and access input before writing", async () => {
    expect((await patch({ code: "g", action: "save", amount: 10, mode: "free" })).status).toBe(400);
    expect(
      (await patch({ code: "g", action: "save", amount: 10, mode: "checkout", accessDays: 1.5, accessLifetime: false }))
        .status,
    ).toBe(400);
    expect(reviewFormat).not.toHaveBeenCalled();
  });

  it("reads an empty price as no price, for the rules to decide", async () => {
    await patch({ code: "way21-individual", action: "approve", amount: "", listAmount: null });
    expect(reviewFormat.mock.calls[0]![0].decision).toEqual({ action: "approve", amount: null, listAmount: null });
  });

  it.each([
    [{ amount: "12.5" }, "format_invalid_amount"],
    [{ amount: "abc" }, "format_invalid_amount"],
    [{ amount: 100, listAmount: 1.5 }, "format_invalid_list_amount"],
  ])("refuses a non-integer price %j", async (prices, error) => {
    const res = await patch({ code: "way21-group", action: "approve", ...prices });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
    expect(reviewFormat).not.toHaveBeenCalled();
  });

  it.each(["decline", "withdraw", "resume"])("passes %s on as a bare decision", async (action) => {
    await patch({ code: "way21-group", action, amount: 999 });
    expect(reviewFormat).toHaveBeenCalledWith({ code: "way21-group", actorId: "u-admin", decision: { action } });
  });

  it("purges the course, the course list and the product offers after a decision", async () => {
    await patch({ code: "way21-group", courseSlug: "way21", action: "withdraw" });
    expect(revalidateTag).toHaveBeenCalledWith("lms-course:way21", { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledWith("lms-courses", { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledWith("product-offers", { expire: 0 });
  });

  it("purges the actual owning course even without a caller-supplied slug", async () => {
    await patch({ code: "way21-group", action: "resume" });
    expect(revalidateTag.mock.calls.map(([tag]) => tag)).toEqual(["lms-course:way21", "lms-courses", "product-offers"]);
  });

  it("keeps a rule refusal's code and status, and purges nothing", async () => {
    reviewFormat.mockRejectedValue(new FormatError("format_not_approved", 409));
    const res = await patch({ code: "way21-self", courseSlug: "way21", action: "resume" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "format_not_approved" });
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("answers an unexpected failure with 500", async () => {
    reviewFormat.mockRejectedValue(new Error("db down"));
    const res = await patch({ code: "way21-self", action: "decline" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "db down" });
  });
});
