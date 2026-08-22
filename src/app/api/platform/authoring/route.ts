/**
 * GET /api/platform/authoring — "which courses may I edit?", asked from the
 * PLATFORM session.
 *
 * Why a second route rather than `/api/lms/authoring/courses`: that one answers
 * the builder, and answers it with everything the builder needs to draw a shelf
 * — titles, covers, readiness, ordering. The platform needs one bit per course
 * and must not carry an author's whole workspace into a public page's payload.
 *
 * The ACCESS RULE is not duplicated. It is imported from `builderAccess`, which
 * stays the only place that decides who may edit what — a second copy of that
 * decision on the platform side is exactly how the two surfaces would drift
 * into disagreeing about ownership.
 *
 * Sessions: this reads the platform's own Supabase session, while the builder
 * runs on its own origin with its own. That is deliberate and already the
 * documented cost of the split (docs/lms-builder-2026-08-21.md) — the platform
 * can tell an author that they may edit a course, and the builder still asks
 * them to sign in when they get there.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { listBuilderCourses } from "@/lib/lms/builder";
import { courseFilterFor, resolveBuilderIdentity } from "@/lib/lms/builderAccess";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  // Not 401: a signed-out visitor asking this is the normal case on a public
  // offer page, and an error there would be noise in every console.
  if (!user) return NextResponse.json({ isAdmin: false, editableCourseSlugs: [] });

  const identity = await resolveBuilderIdentity(user);

  try {
    const courses = await listBuilderCourses(courseFilterFor(identity));
    return NextResponse.json({
      isAdmin: identity.isAdmin,
      editableCourseSlugs: courses.map((course) => course.slug),
    });
  } catch {
    // The offer page shows nothing when this fails, so a broken read must not
    // become a broken page.
    return NextResponse.json({ isAdmin: false, editableCourseSlugs: [] });
  }
}
