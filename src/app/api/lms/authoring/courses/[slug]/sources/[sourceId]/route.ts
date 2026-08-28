/**
 * GET    /api/lms/authoring/courses/:slug/sources/:sourceId — one source, with its text.
 * DELETE /api/lms/authoring/courses/:slug/sources/:sourceId — forget it.
 *
 * Both are scoped by course inside the service, so a source id belonging to
 * another course answers 404 even though the caller holds a valid grant here.
 */

import { NextRequest, NextResponse } from "next/server";

import { withCourseAccess } from "@/lib/lms/courseAccess";
import { LMS_AUTHORING_READ, LMS_COURSE_WRITE } from "@/lib/lms/rateRules";
import { deleteCourseSource, readCourseSource } from "@/lib/lms/sources";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string; sourceId: string }> }) {
  const { slug, sourceId } = await params;

  return withCourseAccess(req, slug, async (grant) => {
    try {
      const source = await readCourseSource(grant.courseId, sourceId);
      if (!source) return NextResponse.json({ error: "source_not_found" }, { status: 404 });
      return NextResponse.json({ source });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }, LMS_AUTHORING_READ);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string; sourceId: string }> }) {
  const { slug, sourceId } = await params;

  return withCourseAccess(req, slug, async (grant) => {
    try {
      await deleteCourseSource(grant.courseId, sourceId);
      return NextResponse.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }, LMS_COURSE_WRITE);
}
