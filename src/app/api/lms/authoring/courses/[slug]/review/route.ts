import { NextRequest, NextResponse } from "next/server";

import { submitBuilderCourseForReview } from "@/lib/lms/builder";
import { withCourseAccess } from "@/lib/lms/courseAccess";
import { LMS_COURSE_WRITE } from "@/lib/lms/rateRules";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return withCourseAccess(
    req,
    slug,
    async (grant) => {
      try {
        /* The identity is known here for certain, so the service is told who
           it is rather than guessing: an admin's own submission is not a
           request the house has to answer (see `reviewAnnounce.ts`). */
        await submitBuilderCourseForReview(slug, grant.identity.authUserId, {
          isAdmin: grant.identity.isAdmin,
          email: grant.identity.email,
        });
        return NextResponse.json({ status: "in_review" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown_error";
        return NextResponse.json({ error: message }, { status: message.startsWith("lms_") ? 422 : 500 });
      }
    },
    LMS_COURSE_WRITE,
  );
}
