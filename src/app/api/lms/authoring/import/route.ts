/**
 * POST /api/lms/authoring/import
 *
 * `{ course, commit: false }` validates and previews without writing.
 * `{ course, commit: true }` writes the normalized copy as a hidden draft.
 */

import { randomUUID } from "node:crypto";

import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import {
  importBuilderCourse,
  listBuilderCourses,
  previewBuilderCourseImport,
} from "@/lib/lms/builder";
import { canCreateCourse, courseFilterFor } from "@/lib/lms/builderAccess";
import { withBuilderIdentity } from "@/lib/lms/courseAccess";
import { LMS_COURSE_CREATE } from "@/lib/lms/rateRules";
import { COURSE_LIST_TAG, PURGE, courseTag } from "@/lib/lms/liveCatalog";

export const runtime = "nodejs";

// Course JSON can contain long text, but a transfer file is not a media
// archive. Images and videos remain references; five MiB is ample for text and
// prevents this authenticated utility becoming an accidental upload sink.
const MAX_BODY_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  return withBuilderIdentity(req, async (identity) => {
    const declaredSize = Number(req.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredSize) && declaredSize > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "lms_builder_import_too_large" }, { status: 413 });
    }

    const owned = await listBuilderCourses(courseFilterFor(identity)).catch(() => null);
    if (!owned) return NextResponse.json({ error: "lms_builder_list_failed" }, { status: 500 });
    if (!canCreateCourse(identity, owned.length)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const rawBody = await req.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "lms_builder_import_too_large" }, { status: 413 });
    }
    let body: { course?: unknown; commit?: unknown } | null = null;
    try {
      body = JSON.parse(rawBody) as { course?: unknown; commit?: unknown };
    } catch {
      // Kept distinct from a structurally invalid course: this is a broken
      // transport file, so the author should choose/fix the JSON itself.
    }
    if (!body || body.course === undefined) {
      return NextResponse.json({ error: "lms_builder_import_missing_course" }, { status: 400 });
    }

    try {
      const preview = await previewBuilderCourseImport(body.course, randomUUID);

      if (body.commit !== true) {
        return NextResponse.json({
          preview: {
            ...preview.summary,
            blockerCount: preview.readiness.blockers.length,
            blockers: preview.readiness.blockers.slice(0, 20),
            changes: ["status:draft", "visibility:hidden", "commerce:detached", "ids:remapped"],
          },
        });
      }

      const result = await importBuilderCourse(preview.course, identity.authUserId);
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
