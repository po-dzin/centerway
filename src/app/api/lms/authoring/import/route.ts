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
  saveBuilderCourse,
  isDraftGeneration,
} from "@/lib/lms/builder";
import { canCreateCourse, courseFilterFor } from "@/lib/lms/builderAccess";
import { portableCourseUpdate, courseReadiness, collectPortableIssues, portableImportNotes } from "@/lms-core";
import { importIssueCopy, importIssueList, importBlockerCopy } from "@/lib/lms/importCopy";
import { resolveCourseAccessForIdentity, isDenied, denialResponse, withBuilderIdentity } from "@/lib/lms/courseAccess";
import { LMS_COURSE_CREATE } from "@/lib/lms/rateRules";
import { COURSE_LIST_TAG, PURGE, courseTag } from "@/lib/lms/liveCatalog";

export const runtime = "nodejs";

// Course JSON can contain long text, but a transfer file is not a media
// archive. Images and videos remain references; five MiB is ample for text and
// prevents this authenticated utility becoming an accidental upload sink.
const MAX_BODY_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  return withBuilderIdentity(
    req,
    async (identity) => {
      const declaredSize = Number(req.headers.get("content-length") ?? "0");
      if (Number.isFinite(declaredSize) && declaredSize > MAX_BODY_BYTES) {
        return NextResponse.json({ error: "lms_builder_import_too_large" }, { status: 413 });
      }

      const owned = await listBuilderCourses(courseFilterFor(identity)).catch(() => null);
      if (!owned) return NextResponse.json({ error: "lms_builder_list_failed" }, { status: 500 });

      const rawBody = await req.text();
      if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
        return NextResponse.json({ error: "lms_builder_import_too_large" }, { status: 413 });
      }
      let body: { course?: unknown; commit?: unknown; targetSlug?: unknown; expectedGeneration?: unknown } | null =
        null;
      try {
        body = JSON.parse(rawBody) as {
          course?: unknown;
          commit?: unknown;
          targetSlug?: unknown;
          expectedGeneration?: unknown;
        };
      } catch {
        // Kept distinct from a structurally invalid course: this is a broken
        // transport file, so the author should choose/fix the JSON itself.
      }
      if (!body || body.course === undefined) {
        return NextResponse.json({ error: "lms_builder_import_missing_course" }, { status: 400 });
      }

      if (body.targetSlug !== undefined && (typeof body.targetSlug !== "string" || !body.targetSlug)) {
        return NextResponse.json({ error: "lms_builder_import_invalid_target" }, { status: 400 });
      }
      const access =
        typeof body.targetSlug === "string" ? await resolveCourseAccessForIdentity(identity, body.targetSlug) : null;
      if (access && isDenied(access)) return denialResponse(access);
      if (!access && !canCreateCourse(identity, owned.length))
        return NextResponse.json({ error: "forbidden" }, { status: 403 });

      try {
        const preview = await previewBuilderCourseImport(body.course, randomUUID);

        const target = access && !isDenied(access) ? await access.grant.load() : null;
        const incoming = target ? portableCourseUpdate(preview.course, target.course) : preview.course;
        const readiness = courseReadiness(incoming);

        if (body.commit !== true) {
          return NextResponse.json({
            preview: {
              ...preview.summary,
              slug: incoming.slug,
              expectedGeneration: target?.draftGeneration,
              notes: portableImportNotes(body.course),
              blockerCount: readiness.blockers.length,
              blockers: readiness.blockers.map((blocker) => ({
                ...blocker,
                message: importBlockerCopy(incoming, blocker),
              })),
              changes: target
                ? ["content:draft", "live:preserved", "access:preserved"]
                : ["status:draft", "visibility:hidden", "commerce:detached", "ids:remapped"],
            },
          });
        }

        if (target && !isDraftGeneration(body.expectedGeneration)) {
          return NextResponse.json(
            { error: "lms_builder_invalid_draft_generation", message: "Повторіть перевірку перед оновленням курсу." },
            { status: 422 },
          );
        }
        const result = target
          ? await saveBuilderCourse(incoming, body.expectedGeneration, { actorId: identity.authUserId })
          : await importBuilderCourse(incoming, identity.authUserId);
        revalidateTag(courseTag(result.slug), PURGE);
        revalidateTag(COURSE_LIST_TAG, PURGE);
        return NextResponse.json(result, { status: 201 });
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown_error";
        const isAuthorError = message.startsWith("lms_");
        const issues =
          isAuthorError && message !== "lms_builder_draft_conflict"
            ? importIssueList(collectPortableIssues(body.course, randomUUID))
            : [];
        return NextResponse.json(
          { error: message, message: issues[0] ?? importIssueCopy(message), ...(issues.length > 1 ? { issues } : {}) },
          { status: message === "lms_builder_draft_conflict" ? 409 : isAuthorError ? 422 : 500 },
        );
      }
    },
    LMS_COURSE_CREATE,
  );
}
