/**
 * The builder's formats endpoint (2026-09-25).
 *
 * The rules of who may change what live in `formatAuthoring` and are tested
 * there. This suite guards the envelope around them: nobody reaches a handler
 * without a course grant, the grant's identity (and whether it is the owner) is
 * what gets passed down — never anything from the body — a rule refusal keeps
 * its code and status on the way out, and every write purges the cached course
 * so the storefront does not keep selling what was just changed.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const listCourseFormats = vi.fn();
const listIncludablePrograms = vi.fn();
const createFormat = vi.fn();
const updateFormat = vi.fn();
const deleteFormat = vi.fn();
const revalidateTag = vi.fn();

let grant: {
  courseId: string;
  slug: string;
  identity: { authUserId: string; isAdmin: boolean; canSetPrice?: boolean; email: string };
} | null;
let denial: "unauthenticated" | "not_found" = "not_found";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidateTag, unstable_cache: (fn: () => unknown) => fn }));
vi.mock("@/lib/lms/liveCatalog", () => ({
  COURSE_LIST_TAG: "lms-courses",
  PURGE: { expire: 0 },
  courseTag: (slug: string) => `lms-course:${slug}`,
}));
vi.mock("@/lib/lms/rateRules", () => ({ LMS_AUTHORING_READ: { name: "read" }, LMS_COURSE_WRITE: { name: "write" } }));
vi.mock("@/lib/lms/courseAccess", () => ({
  withCourseAccess: vi.fn(async (_req: unknown, _slug: string, run: (grant: unknown) => Promise<NextResponse>) => {
    if (!grant) {
      return denial === "unauthenticated"
        ? NextResponse.json({ error: "unauthorized" }, { status: 401 })
        : NextResponse.json({ error: "course_not_found" }, { status: 404 });
    }
    return run(grant);
  }),
}));
vi.mock("@/lib/experiences/formatAuthoring", () => {
  class FormatError extends Error {
    constructor(
      public readonly code: string,
      public readonly status = 400,
    ) {
      super(code);
    }
  }
  return { FormatError, listCourseFormats, listIncludablePrograms, createFormat, updateFormat, deleteFormat };
});

const { GET, POST, PATCH, DELETE } = await import("./route");
const { FormatError } = await import("@/lib/experiences/formatAuthoring");
const { withCourseAccess } = await import("@/lib/lms/courseAccess");

const URL_BASE = "https://my.centerway.net.ua/api/lms/authoring/courses/way21/formats";
const params = { params: Promise.resolve({ slug: "way21" }) };

function request(method: string, body?: unknown, query = "") {
  return new NextRequest(`${URL_BASE}${query}`, {
    method,
    headers: { authorization: "Bearer token", "content-type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

const author = {
  courseId: "c-way21",
  slug: "way21",
  identity: { authUserId: "u-author", isAdmin: false, email: "a@x" },
};
const owner = {
  courseId: "c-way21",
  slug: "way21",
  identity: { authUserId: "u-admin", isAdmin: true, canSetPrice: true, email: "o@x" },
};

function expectPurged() {
  expect(revalidateTag).toHaveBeenCalledWith("lms-course:way21", { expire: 0 });
  expect(revalidateTag).toHaveBeenCalledWith("lms-courses", { expire: 0 });
}

beforeEach(() => {
  vi.clearAllMocks();
  grant = author;
  denial = "not_found";
});

describe("access", () => {
  it.each([
    ["GET", () => GET(request("GET"), params)],
    ["POST", () => POST(request("POST", { format: "self" }), params)],
    ["PATCH", () => PATCH(request("PATCH", { code: "way21-self" }), params)],
    ["DELETE", () => DELETE(request("DELETE", undefined, "?code=way21-self"), params)],
  ])("%s refuses a caller without a grant and touches nothing", async (_method, call) => {
    grant = null;
    const res = await call();
    expect(res.status).toBe(404);
    for (const fn of [listCourseFormats, listIncludablePrograms, createFormat, updateFormat, deleteFormat]) {
      expect(fn).not.toHaveBeenCalled();
    }
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("refuses an unauthenticated caller with 401", async () => {
    grant = null;
    denial = "unauthenticated";
    const res = await GET(request("GET"), params);
    expect(res.status).toBe(401);
  });

  it("asks for access to the slug in the URL, with the read limit on GET and the write limit on writes", async () => {
    await GET(request("GET"), params);
    await POST(request("POST", { format: "self" }), params);
    const calls = vi.mocked(withCourseAccess).mock.calls;
    expect(calls[0]![1]).toBe("way21");
    expect(calls[0]![3]).toEqual({ name: "read" });
    expect(calls[1]![3]).toEqual({ name: "write" });
  });
});

describe("GET", () => {
  it("returns formats and includable programs for the grant's identity", async () => {
    listCourseFormats.mockResolvedValue([{ code: "course:way21" }]);
    listIncludablePrograms.mockResolvedValue([{ slug: "reset-day" }]);
    const res = await GET(request("GET"), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      formats: [{ code: "course:way21" }],
      includable: [{ slug: "reset-day" }],
      isOwner: false,
      canSetPrice: false,
    });
    expect(listCourseFormats).toHaveBeenCalledWith("c-way21");
    expect(listIncludablePrograms).toHaveBeenCalledWith({
      courseId: "c-way21",
      authUserId: "u-author",
      isAdmin: false,
    });
  });

  it("tells the builder when the caller is the owner", async () => {
    grant = owner;
    listCourseFormats.mockResolvedValue([]);
    listIncludablePrograms.mockResolvedValue([]);
    const res = await GET(request("GET"), params);
    expect(await res.json()).toMatchObject({ isOwner: true, canSetPrice: true });
    expect(listIncludablePrograms).toHaveBeenCalledWith({ courseId: "c-way21", authUserId: "u-admin", isAdmin: true });
  });

  it("keeps a FormatError's code and status", async () => {
    listCourseFormats.mockRejectedValue(new FormatError("format_course_not_registered", 409));
    listIncludablePrograms.mockResolvedValue([]);
    const res = await GET(request("GET"), params);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "format_course_not_registered" });
  });

  it("answers anything else with 500 and its message", async () => {
    listCourseFormats.mockRejectedValue(new Error("socket"));
    listIncludablePrograms.mockResolvedValue([]);
    const res = await GET(request("GET"), params);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "socket" });
  });
});

describe("POST", () => {
  it("creates with the grant's identity, not one from the body, and purges the course", async () => {
    createFormat.mockResolvedValue("way21-group");
    const body = { format: "group", isAdmin: true, authUserId: "u-admin" };
    const res = await POST(request("POST", body), params);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ code: "way21-group" });
    expect(createFormat).toHaveBeenCalledWith({
      courseId: "c-way21",
      authUserId: "u-author",
      isAdmin: false,
      canSetPrice: false,
      body,
    });
    expectPurged();
  });

  it("passes the owner through as the owner", async () => {
    grant = owner;
    createFormat.mockResolvedValue("way21-self");
    await POST(request("POST", { format: "self" }), params);
    expect(createFormat.mock.calls[0]![0]).toMatchObject({ authUserId: "u-admin", isAdmin: true, canSetPrice: true });
  });

  it("hands an unreadable body on as an empty one, for the rules to refuse", async () => {
    createFormat.mockRejectedValue(new FormatError("format_invalid_kind"));
    const res = await POST(request("POST", "{not json"), params);
    expect(createFormat.mock.calls[0]![0].body).toEqual({});
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "format_invalid_kind" });
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("keeps a 403 refusal for someone else's program", async () => {
    createFormat.mockRejectedValue(new FormatError("format_include_not_yours", 403));
    const res = await POST(request("POST", { format: "group", includes: ["other"] }), params);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "format_include_not_yours" });
  });
});

describe("PATCH", () => {
  it("requires a code", async () => {
    for (const body of [{}, { code: "" }, { code: 5 }]) {
      const res = await PATCH(request("PATCH", body), params);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "format_code_required" });
    }
    expect(updateFormat).not.toHaveBeenCalled();
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("updates the named format with the grant's identity and purges the course", async () => {
    const body = { code: "way21-group", label: "Потік", submit: true };
    const res = await PATCH(request("PATCH", body), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(updateFormat).toHaveBeenCalledWith({
      courseId: "c-way21",
      authUserId: "u-author",
      isAdmin: false,
      canSetPrice: false,
      code: "way21-group",
      body,
    });
    expectPurged();
  });

  it("keeps the approved-format lock as a 409 and purges nothing", async () => {
    updateFormat.mockRejectedValue(new FormatError("format_approved_locked", 409));
    const res = await PATCH(request("PATCH", { code: "way21-group", mode: "lead" }), params);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "format_approved_locked" });
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});

describe("DELETE", () => {
  it("requires a code in the query", async () => {
    const res = await DELETE(request("DELETE"), params);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "format_code_required" });
    expect(deleteFormat).not.toHaveBeenCalled();
  });

  it("deletes with the grant's course and ownership, and purges the course", async () => {
    grant = owner;
    const res = await DELETE(request("DELETE", undefined, "?code=way21-self"), params);
    expect(res.status).toBe(200);
    expect(deleteFormat).toHaveBeenCalledWith({ courseId: "c-way21", isAdmin: true, code: "way21-self" });
    expectPurged();
  });

  it("keeps a not-found refusal as a 404", async () => {
    deleteFormat.mockRejectedValue(new FormatError("format_not_found", 404));
    const res = await DELETE(request("DELETE", undefined, "?code=course:other"), params);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "format_not_found" });
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
