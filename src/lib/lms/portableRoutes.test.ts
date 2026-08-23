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
  modules: [{
    id: "fresh-module",
    slug: "start",
    title: "Початок",
    order: 1,
    lessons: [{
      id: "fresh-lesson",
      slug: "welcome",
      title: "Вступ",
      order: 1,
      blocks: [{ id: "fresh-block", type: "lesson_objective", text: "Почати." }],
    }],
  }],
};

const session = { user: { id: "author-1" } };
const auth = { allowed: true };
const builder = {
  listBuilderCourses: vi.fn(),
  previewBuilderCourseImport: vi.fn(),
  importBuilderCourse: vi.fn(),
  loadBuilderCourse: vi.fn(),
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
  for (const fn of Object.values(builder)) fn.mockReset();
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
  builder.loadBuilderCourse.mockResolvedValue({ course, authorId: "author-1", updatedAt: null });
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
