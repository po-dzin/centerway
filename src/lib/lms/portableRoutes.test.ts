import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import type { Course } from "@/lms-core";

const course: Course = {
  id: "fresh-course",
  slug: "portable-course-2",
  title: "Переносимий курс",
  programSlug: "reset-day",
  brand: "centerway",
  locale: "uk",
  translationGroupId: "fresh-translation",
  status: "draft",
  version: 1,
  schedule: { mode: "open" },
  entitlementProductCodes: [],
  visibility: "hidden",
  modules: [
    {
      id: "fresh-module",
      slug: "start",
      title: "Початок",
      order: 1,
      lessons: [
        {
          id: "fresh-lesson",
          slug: "welcome",
          title: "Вступ",
          order: 1,
          blocks: [{ id: "fresh-block", type: "lesson_objective", text: "Почати." }],
        },
      ],
    },
  ],
};

const session = { user: { id: "author-1" } };
const auth = { allowed: true };
const builder = {
  listBuilderCourses: vi.fn(),
  previewBuilderCourseImport: vi.fn(),
  importBuilderCourse: vi.fn(),
  loadBuilderCourse: vi.fn(),
  saveBuilderCourse: vi.fn(),
  isDraftGeneration: (value: unknown) => typeof value === "number" && value >= 0 && Number.isInteger(value),
  // The ownership probe `courseAccess` runs before the full load.
  readCourseOwnership: vi.fn(),
};

vi.mock("@/lib/auth/requireUser", () => ({
  requireUserFromBearer: async () => (auth.allowed ? session.user : null),
}));

vi.mock("@/lib/lms/builder", () => builder);

vi.mock("@/lib/lms/builderAccess", () => ({
  resolveBuilderIdentity: async () => ({ authUserId: "author-1", isAdmin: false }),
  courseFilterFor: () => ({ authorId: "author-1" }),
  canCreateCourse: () => true,
  canEditCourse: () => true,
}));

// The routes now carry a rate limit, which talks to Postgres. These tests are
// about what the routes do with a course, so the limiter answers "allowed"
// rather than failing open through a real client that has no database.
vi.mock("@/lib/api/rateLimit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/rateLimit")>()),
  enforceRateLimit: async () => ({ allowed: true, retryAfter: 0, count: 0 }),
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

const importRoute = await import("@/app/api/lms/authoring/import/route");
const exportRoute = await import("@/app/api/lms/authoring/courses/[slug]/export/route");

function post(body: unknown) {
  return new NextRequest("http://x/api/lms/authoring/import", {
    method: "POST",
    headers: { authorization: "Bearer test", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  auth.allowed = true;
  for (const fn of Object.values(builder)) if ("mockReset" in fn) fn.mockReset();
  builder.listBuilderCourses.mockResolvedValue([]);
  builder.previewBuilderCourseImport.mockResolvedValue({
    course,
    readiness: { ready: true, blockers: [] },
    summary: {
      sourceSlug: "portable-course",
      slug: course.slug,
      title: course.title,
      locale: course.locale,
      moduleCount: 1,
      lessonCount: 1,
      blockCount: 1,
    },
  });
  builder.importBuilderCourse.mockResolvedValue({ slug: course.slug });
  builder.loadBuilderCourse.mockResolvedValue({ course, authorId: "author-1", updatedAt: null, draftGeneration: 4 });
  builder.readCourseOwnership.mockResolvedValue({ id: course.id, slug: course.slug, authorId: "author-1" });
});

describe("portable course import route", () => {
  it("previews without invoking the write", async () => {
    const response = await importRoute.POST(post({ course: { any: "source" }, commit: false }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ preview: { slug: "portable-course-2", blockerCount: 0 } });
    expect(builder.previewBuilderCourseImport).toHaveBeenCalledOnce();
    expect(builder.importBuilderCourse).not.toHaveBeenCalled();
  });

  it("writes only the normalized draft returned by preview", async () => {
    const response = await importRoute.POST(post({ course: { any: "source" }, commit: true }));
    expect(response.status).toBe(201);
    expect(builder.importBuilderCourse).toHaveBeenCalledWith(course, "author-1");
  });

  it("updates only the authorized target using its preview generation", async () => {
    builder.saveBuilderCourse.mockResolvedValue({ slug: course.slug, staged: true });
    const inspected = await importRoute.POST(post({ course, targetSlug: course.slug }));
    expect(await inspected.json()).toMatchObject({ preview: { slug: course.slug, expectedGeneration: 4 } });
    const response = await importRoute.POST(
      post({ course, targetSlug: course.slug, commit: true, expectedGeneration: 4 }),
    );
    expect(response.status).toBe(201);
    expect(builder.saveBuilderCourse).toHaveBeenCalledWith(
      expect.objectContaining({ id: course.id, slug: course.slug }),
      4,
      { actorId: "author-1" },
    );
    expect(builder.importBuilderCourse).not.toHaveBeenCalled();
  });

  it("refuses a missing generation and returns stale writes as conflicts", async () => {
    expect((await importRoute.POST(post({ course, targetSlug: course.slug, commit: true }))).status).toBe(422);
    expect(builder.saveBuilderCourse).not.toHaveBeenCalled();
    builder.saveBuilderCourse.mockRejectedValue(new Error("lms_builder_draft_conflict"));
    expect(
      (await importRoute.POST(post({ course, targetSlug: course.slug, commit: true, expectedGeneration: 3 }))).status,
    ).toBe(409);
  });

  it("does not preview or write a target outside the ownership boundary", async () => {
    builder.readCourseOwnership.mockResolvedValue(null);
    expect(
      (await importRoute.POST(post({ course, targetSlug: "someone-else", commit: true, expectedGeneration: 4 })))
        .status,
    ).toBe(404);
    expect(builder.previewBuilderCourseImport).not.toHaveBeenCalled();
    expect(builder.saveBuilderCourse).not.toHaveBeenCalled();
  });

  it("returns Ukrainian structural errors with one-based location", async () => {
    builder.previewBuilderCourseImport.mockRejectedValue(
      new Error("lms_block_empty_content:portable.modules[0].lessons[0].blocks[0]"),
    );
    const response = await importRoute.POST(post({ course }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ message: expect.stringContaining("Модуль 1, урок 1, блок 1") });
  });

  it("refuses the boundary before reading any course when signed out", async () => {
    auth.allowed = false;
    const response = await importRoute.POST(post({ course, commit: true }));
    expect(response.status).toBe(401);
    expect(builder.listBuilderCourses).not.toHaveBeenCalled();
  });
});

describe("portable course export route", () => {
  it("returns the current course as a no-store downloadable JSON file", async () => {
    const request = new NextRequest("http://x/api/lms/authoring/courses/portable-course-2/export", {
      headers: { authorization: "Bearer test" },
    });
    const response = await exportRoute.GET(request, { params: Promise.resolve({ slug: course.slug }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="portable-course-2.json"');
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(JSON.parse(await response.text())).toEqual(course);
  });
});
