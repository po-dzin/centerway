import { NextRequest, NextResponse } from "next/server";

import { restoreBuilderCourseRevision } from "@/lib/lms/builder";
import { withCourseAccess } from "@/lib/lms/courseAccess";
import { LMS_COURSE_WRITE } from "@/lib/lms/rateRules";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string; revisionId: string }> }) {
  const { slug, revisionId } = await params;

  return withCourseAccess(req, slug, async (grant) => {
    try {
      const restored = await restoreBuilderCourseRevision({
        slug,
        revisionId,
        actorId: grant.identity.authUserId,
      });
      return NextResponse.json({ restored });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      if (message === "lms_builder_revision_not_found") {
        return NextResponse.json({ error: message }, { status: 404 });
      }
      // Every `lms_*` code here is a refusal the author can act on — a stale
      // tab, an absent migration, a snapshot whose lessons a learner has since
      // started. Only an unrecognised failure is a 500.
      return NextResponse.json({ error: message }, { status: message.startsWith("lms_") ? 422 : 500 });
    }
  }, LMS_COURSE_WRITE);
}
