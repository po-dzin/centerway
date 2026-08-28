/** Export the current database course as the canonical portable Course JSON. */

import { NextRequest, NextResponse } from "next/server";

import { withCourseAccess } from "@/lib/lms/courseAccess";
import { LMS_AUTHORING_READ } from "@/lib/lms/rateRules";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return withCourseAccess(req, slug, async (grant) => {
    try {
      const loaded = await grant.load();
      return new NextResponse(`${JSON.stringify(loaded.course, null, 2)}\n`, {
        headers: {
          "cache-control": "private, no-store",
          "content-disposition": `attachment; filename="${loaded.course.slug}.json"`,
          "content-type": "application/json; charset=utf-8",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      return NextResponse.json({ error: message }, { status: message.startsWith("lms_") ? 422 : 500 });
    }
  }, LMS_AUTHORING_READ);
}
