/**
 * GET  /api/lms/authoring/courses — the builder's course list.
 * POST /api/lms/authoring/courses — a new course, from nothing.
 * PATCH /api/lms/authoring/courses — the author's own order for their shelf.
 *
 * Same Bearer contract as the rest of /api/lms/*. The builder runs on its own
 * origin and its own session, but it is not a different protocol: an agent that
 * later writes courses (H3) calls exactly these routes.
 */

import { randomUUID } from "node:crypto";

import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { createBuilderCourse, listBuilderCourses, reorderBuilderCourses } from "@/lib/lms/builder";
import { canCreateCourse, canEditCourse, courseFilterFor } from "@/lib/lms/builderAccess";
import { withBuilderIdentity } from "@/lib/lms/courseAccess";
import { COURSE_LIST_TAG, PURGE, courseTag } from "@/lib/lms/liveCatalog";
import { LMS_AUTHORING_READ, LMS_COURSE_CREATE, LMS_COURSE_WRITE } from "@/lib/lms/rateRules";
import { COURSE_PALETTES } from "@/lms-core";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return withBuilderIdentity(req, async (identity) => {
    try {
      const courses = await listBuilderCourses(courseFilterFor(identity));
      return NextResponse.json({
        courses,
        isAdmin: identity.isAdmin,
        canCreate: canCreateCourse(identity, courses.length),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }, LMS_AUTHORING_READ);
}

export async function POST(req: NextRequest) {
  return withBuilderIdentity(req, async (identity) => {
    // The permission depends on what this identity already owns, so it is read
    // from the same filter the list uses rather than from a role alone.
    const owned = await listBuilderCourses(courseFilterFor(identity)).catch(() => null);
    if (!owned) return NextResponse.json({ error: "lms_builder_list_failed" }, { status: 500 });
    if (!canCreateCourse(identity, owned.length)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as {
      title?: unknown;
      template?: unknown;
      palette?: unknown;
    } | null;
    const title = typeof body?.title === "string" ? body.title.trim() : undefined;

    // The palette is validated by name, not trusted: `validateCourseTheme` runs
    // inside `validateCourse` on the way to the database, and an unknown one
    // would fail the write with a code about a theme rather than about a payload.
    const palette = COURSE_PALETTES.find((known) => known === body?.palette);

    try {
      const result = await createBuilderCourse({
        title,
        authorId: identity.authUserId,
        template: typeof body?.template === "string" ? body.template : undefined,
        ...(palette && palette !== "default" ? { theme: { palette } } : {}),
        ids: () => randomUUID(),
      });
      revalidateTag(courseTag(result.slug), PURGE);
      revalidateTag(COURSE_LIST_TAG, PURGE);
      return NextResponse.json(result, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      const isAuthorError = message.startsWith("lms_");
      return NextResponse.json({ error: message }, { status: isAuthorError ? 422 : 500 });
    }
  }, LMS_COURSE_CREATE);
}

export async function PATCH(req: NextRequest) {
  return withBuilderIdentity(req, async (identity) => {
    const body = (await req.json().catch(() => null)) as { slugs?: unknown } | null;
    const slugs = Array.isArray(body?.slugs) ? body.slugs.filter((slug): slug is string => typeof slug === "string") : null;
    if (!slugs || slugs.length === 0) return NextResponse.json({ error: "missing_slugs" }, { status: 400 });

    try {
      // Permission is decided from the rows themselves, not from the payload: a
      // slug the caller cannot edit must not be reorderable by naming it.
      const visible = await listBuilderCourses(courseFilterFor(identity));
      const editable = new Map(visible.map((course) => [course.slug, course.authorId] as const));
      await reorderBuilderCourses(slugs, (slug) =>
        editable.has(slug) && canEditCourse(identity, editable.get(slug) ?? null)
      );
      return NextResponse.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      const isAuthorError = message.startsWith("lms_");
      return NextResponse.json({ error: message }, { status: isAuthorError ? 422 : 500 });
    }
  }, LMS_COURSE_WRITE);
}
