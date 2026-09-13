import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/* The direct-publish route at the transport: who may call it, which of the two
   writes it makes, and that the storefront's caches are purged after them. The
   writes themselves are covered where they live (`moderateCourse`,
   `submitBuilderCourseForReview`); this file pins the order and the gate. */

const state = {
  isAdmin: true,
  reviewStatus: "draft" as string,
};
const calls: string[] = [];

const submitBuilderCourseForReview = vi.fn();
const moderateCourse = vi.fn();
const revalidateTag = vi.fn();

vi.mock("next/cache", () => ({ revalidateTag }));
vi.mock("@/lib/lms/builder", () => ({ submitBuilderCourseForReview }));
vi.mock("@/lib/admin/access/courses", () => ({ moderateCourse }));
vi.mock("@/lib/lms/courseAccess", () => ({
  withCourseAccess: async (
    _req: NextRequest,
    _slug: string,
    run: (grant: {
      identity: { authUserId: string; isAdmin: boolean };
      load: () => Promise<{ reviewStatus: string; course: { id: string } }>;
    }) => Promise<NextResponse>,
  ) =>
    run({
      identity: { authUserId: "staff-1", isAdmin: state.isAdmin },
      load: async () => ({ reviewStatus: state.reviewStatus, course: { id: "course-1" } }),
    }),
}));
vi.mock("@/lib/lms/liveCatalog", () => ({
  COURSE_LIST_TAG: "lms-courses",
  PURGE: { expire: 0 },
  courseTag: (slug: string) => `lms-course:${slug}`,
}));
vi.mock("@/lib/lms/rateRules", () => ({ LMS_COURSE_WRITE: {} }));

const route = await import("./route");

function publish(slug = "way21") {
  return route.POST(new NextRequest(`http://x/api/lms/authoring/courses/${slug}/publish`, { method: "POST" }), {
    params: Promise.resolve({ slug }),
  });
}

beforeEach(() => {
  state.isAdmin = true;
  state.reviewStatus = "draft";
  calls.length = 0;
  submitBuilderCourseForReview.mockReset().mockImplementation(async () => {
    calls.push("submit");
  });
  moderateCourse.mockReset().mockImplementation(async () => {
    calls.push("approve");
  });
  revalidateTag.mockReset();
});

describe("direct publish route", () => {
  it("refuses an author and writes nothing", async () => {
    state.isAdmin = false;

    const response = await publish();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "lms_publish_requires_admin" });
    expect(submitBuilderCourseForReview).not.toHaveBeenCalled();
    expect(moderateCourse).not.toHaveBeenCalled();
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("submits, then approves, then purges both caches for an admin", async () => {
    const response = await publish("way21");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "published" });
    expect(calls).toEqual(["submit", "approve"]);
    expect(submitBuilderCourseForReview).toHaveBeenCalledWith("way21", "staff-1");
    expect(moderateCourse).toHaveBeenCalledWith({ courseId: "course-1", actorId: "staff-1", action: "approve" });
    expect(revalidateTag).toHaveBeenCalledWith("lms-course:way21", { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledWith("lms-courses", { expire: 0 });
  });

  it("only approves a course that is already in the review queue", async () => {
    state.reviewStatus = "in_review";

    const response = await publish();

    expect(response.status).toBe(200);
    expect(calls).toEqual(["approve"]);
    expect(submitBuilderCourseForReview).not.toHaveBeenCalled();
  });

  it("answers a domain refusal with 422 and does not purge", async () => {
    moderateCourse.mockImplementation(async () => {
      throw new Error("lms_course_not_in_review");
    });

    const response = await publish();

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "lms_course_not_in_review" });
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("answers anything else with 500", async () => {
    submitBuilderCourseForReview.mockImplementation(async () => {
      throw new Error("connection reset");
    });

    const response = await publish();

    expect(response.status).toBe(500);
    expect(moderateCourse).not.toHaveBeenCalled();
  });
});
