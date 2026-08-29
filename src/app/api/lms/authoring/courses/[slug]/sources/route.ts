/**
 * GET  /api/lms/authoring/courses/:slug/sources — the materials this course was built from.
 * POST /api/lms/authoring/courses/:slug/sources — register one more.
 *
 * The list omits the extracted text on purpose (see `sources.ts`); one source
 * with its text is `sources/:sourceId`.
 *
 * A learner never reaches this route, and the table's RLS says so as well —
 * material is the author's working copy, which may hold unedited notes and
 * claims that never passed the readiness gate.
 */

import { NextRequest, NextResponse } from "next/server";

import { withCourseAccess } from "@/lib/lms/courseAccess";
import { LMS_AUTHORING_READ, LMS_COURSE_WRITE } from "@/lib/lms/rateRules";
import { listCourseSources, registerCourseSource } from "@/lib/lms/sources";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return withCourseAccess(req, slug, async (grant) => {
    try {
      return NextResponse.json({ sources: await listCourseSources(grant.courseId) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }, LMS_AUTHORING_READ);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return withCourseAccess(req, slug, async (grant) => {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "lms_source_missing_body" }, { status: 400 });

    try {
      const source = await registerCourseSource({
        courseId: grant.courseId,
        kind: body.kind,
        title: body.title,
        origin: body.origin,
        mimeType: body.mimeType,
        byteSize: body.byteSize,
        checksum: body.checksum,
        extractedText: body.extractedText,
        uploadedBy: grant.identity.authUserId,
      });
      return NextResponse.json({ source }, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      if (message === "lms_source_duplicate") return NextResponse.json({ error: message }, { status: 409 });
      const isAuthorError = message.startsWith("lms_source_") && !message.includes("_failed:");
      return NextResponse.json({ error: message }, { status: isAuthorError ? 422 : 500 });
    }
  }, LMS_COURSE_WRITE);
}
