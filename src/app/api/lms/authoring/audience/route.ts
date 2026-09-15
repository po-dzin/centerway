/**
 * GET /api/lms/authoring/audience — how many people are in the author's courses.
 *
 * FOUR INTEGERS PER COURSE AND NOTHING ELSE. No account, no name, no email, no
 * enrollment id crosses this boundary: an author learns that seven people opened
 * the course this week, never which seven. That is the annotation privacy rule
 * (`docs/design-system.md`, and `lms_annotations` having no staff policy) held
 * one level up — aggregate is the author's, the person is not.
 *
 * Scoped by `courseFilterFor(identity)`, the same boundary the shelf and the
 * journal draw, so the question «whose courses» has one answer in the workshop.
 */

import { NextRequest, NextResponse } from "next/server";

import { readCourseAudience } from "@/lib/lms/authorAudience";
import { listBuilderCourseIdentities } from "@/lib/lms/builder";
import { courseFilterFor } from "@/lib/lms/builderAccess";
import { withBuilderIdentity } from "@/lib/lms/courseAccess";
import { LMS_AUTHORING_READ } from "@/lib/lms/rateRules";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return withBuilderIdentity(
    req,
    async (identity) => {
      try {
        const courses = await listBuilderCourseIdentities(courseFilterFor(identity));
        const audience = await readCourseAudience(courses.map((course) => course.id));
        return NextResponse.json({
          /* Keyed by SLUG, not by course id. The dashboard already holds the
           courses by slug and has no reason to learn a second identifier for
           the same thing. */
          audience: Object.fromEntries(
            courses.flatMap((course) => {
              const entry = audience.get(course.id);
              return entry ? [[course.slug, entry] as const] : [];
            }),
          ),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown_error";
        return NextResponse.json({ error: message }, { status: 500 });
      }
    },
    LMS_AUTHORING_READ,
  );
}
