import { NextRequest, NextResponse } from "next/server";

import { submitBuilderCourseForReview } from "@/lib/lms/builder";
import { withCourseAccess } from "@/lib/lms/courseAccess";
import { LMS_COURSE_WRITE } from "@/lib/lms/rateRules";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return withCourseAccess(req, slug, async () => {
    try {
      await submitBuilderCourseForReview(slug);
      return NextResponse.json({ status: "in_review" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      return NextResponse.json({ error: message }, { status: message.startsWith("lms_") ? 422 : 500 });
    }
  }, LMS_COURSE_WRITE);
}
