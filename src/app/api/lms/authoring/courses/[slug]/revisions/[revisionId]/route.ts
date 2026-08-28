import { NextRequest, NextResponse } from "next/server";

import { withCourseAccess } from "@/lib/lms/courseAccess";
import { LMS_AUTHORING_READ } from "@/lib/lms/rateRules";
import { loadCourseRevision } from "@/lib/lms/revisions";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string; revisionId: string }> }) {
  const { slug, revisionId } = await params;

  return withCourseAccess(req, slug, async (grant) => {
    try {
      const revision = await loadCourseRevision(grant.courseId, revisionId);
      if (!revision) return NextResponse.json({ error: "revision_not_found" }, { status: 404 });
      return NextResponse.json({ revision });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      return NextResponse.json({ error: message }, { status: message.startsWith("lms_") ? 422 : 500 });
    }
  }, LMS_AUTHORING_READ);
}
