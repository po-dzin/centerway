import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import type { Author } from "@/lms-core";

const own: Author = { id: "author-own", slug: "own", name: "Мій автор" };
const assigned: Author = { id: "author-assigned", slug: "assigned", name: "Призначений автор" };
const state = {
  own: own as Author | null,
  linked: assigned as Author | null,
  linkedId: assigned.id as string | null,
  linkResult: { ok: true } as { ok: true } | { ok: false; error: string },
};
const authors = {
  getAuthorProfileForUser: vi.fn(),
  getCourseAuthor: vi.fn(),
  getCourseAuthorProfileId: vi.fn(),
  linkCourseAuthorProfile: vi.fn(),
};
const revalidateTag = vi.fn();

vi.mock("next/cache", () => ({ revalidateTag }));
vi.mock("@/lib/lms/authors", () => ({
  AUTHOR_LIST_TAG: "lms-authors",
  ...authors,
}));
vi.mock("@/lib/lms/courseAccess", () => ({
  withCourseAccess: async (_req: NextRequest, _slug: string, run: (grant: {
    identity: { authUserId: string };
    courseId: string;
  }) => Promise<NextResponse>) => run({ identity: { authUserId: "owner-1" }, courseId: "course-1" }),
}));
vi.mock("@/lib/lms/liveCatalog", () => ({ PURGE: {}, courseTag: (slug: string) => `course:${slug}` }));
vi.mock("@/lib/lms/rateRules", () => ({ LMS_AUTHORING_READ: {}, LMS_COURSE_WRITE: {} }));

const route = await import("./route");

function patch(body: unknown) {
  return new NextRequest("http://x/api/lms/authoring/courses/way21/author", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function malformedPatch() {
  return new NextRequest("http://x/api/lms/authoring/courses/way21/author", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: "{",
  });
}

beforeEach(() => {
  state.own = own;
  state.linked = assigned;
  state.linkedId = assigned.id;
  state.linkResult = { ok: true };
  revalidateTag.mockReset();
  for (const fn of Object.values(authors)) fn.mockReset();
  authors.getAuthorProfileForUser.mockImplementation(async () => ({ eligible: true, author: state.own }));
  authors.getCourseAuthor.mockImplementation(async () => state.linked);
  authors.getCourseAuthorProfileId.mockImplementation(async () => state.linkedId);
  authors.linkCourseAuthorProfile.mockImplementation(async (_courseId: string, authorId: string | null) => {
    if (state.linkResult.ok) {
      state.linkedId = authorId;
      state.linked = authorId === own.id ? own : null;
    }
    return state.linkResult;
  });
});

describe("course author link route", () => {
  it("reads the caller's profile and an independently assigned byline", async () => {
    const response = await route.GET(new NextRequest("http://x/api/lms/authoring/courses/way21/author"), {
      params: Promise.resolve({ slug: "way21" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ownAuthor: own, linkedAuthor: assigned, linkedAuthorId: assigned.id });
  });

  it("lets the course owner replace an admin-set fallback with their own profile", async () => {
    const response = await route.PATCH(patch({ action: "attach-self" }), { params: Promise.resolve({ slug: "way21" }) });

    expect(response.status).toBe(200);
    expect(authors.linkCourseAuthorProfile).toHaveBeenCalledWith("course-1", own.id);
    expect(await response.json()).toMatchObject({ linkedAuthor: own, linkedAuthorId: own.id });
    expect(revalidateTag).toHaveBeenCalledWith("course:way21", {});
    expect(revalidateTag).toHaveBeenCalledWith("lms-authors", {});
  });

  it("lets the course owner clear an existing link", async () => {
    const response = await route.PATCH(patch({ action: "detach" }), { params: Promise.resolve({ slug: "way21" }) });

    expect(response.status).toBe(200);
    expect(authors.linkCourseAuthorProfile).toHaveBeenCalledWith("course-1", null);
    expect(await response.json()).toMatchObject({ linkedAuthor: null, linkedAuthorId: null });
  });

  it("refuses a self-attach when the owner has no profile, leaving the current link untouched", async () => {
    state.own = null;
    const response = await route.PATCH(patch({ action: "attach-self" }), { params: Promise.resolve({ slug: "way21" }) });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "lms_author_profile_missing" });
    expect(authors.linkCourseAuthorProfile).not.toHaveBeenCalled();
    expect(state.linked).toEqual(assigned);
  });

  it.each([undefined, "attach-other"])(
    "rejects an invalid action: %j",
    async (body) => {
      const response = await route.PATCH(patch(body), { params: Promise.resolve({ slug: "way21" }) });
      expect(response.status).toBe(400);
      expect(authors.linkCourseAuthorProfile).not.toHaveBeenCalled();
    },
  );

  it("rejects malformed JSON before touching the course", async () => {
    const response = await route.PATCH(malformedPatch(), { params: Promise.resolve({ slug: "way21" }) });
    expect(response.status).toBe(400);
    expect(authors.getAuthorProfileForUser).not.toHaveBeenCalled();
    expect(authors.linkCourseAuthorProfile).not.toHaveBeenCalled();
  });

  it("ignores a forged profile id and still links only the caller's own profile", async () => {
    const response = await route.PATCH(patch({ action: "attach-self", authorProfileId: "author-someone-else" }), {
      params: Promise.resolve({ slug: "way21" }),
    });

    expect(response.status).toBe(200);
    expect(authors.linkCourseAuthorProfile).toHaveBeenCalledWith("course-1", own.id);
    expect(authors.linkCourseAuthorProfile).not.toHaveBeenCalledWith("course-1", "author-someone-else");
  });

  it("does not claim success or invalidate caches when the relationship write fails", async () => {
    state.linkResult = { ok: false, error: "db_write_failed" };
    const response = await route.PATCH(patch({ action: "attach-self" }), { params: Promise.resolve({ slug: "way21" }) });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "db_write_failed" });
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(authors.getCourseAuthor).not.toHaveBeenCalled();
  });
});
