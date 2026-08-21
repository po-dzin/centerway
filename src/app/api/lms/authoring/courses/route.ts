/**
 * GET /api/lms/authoring/courses — the builder's course list.
 *
 * Same Bearer contract as the rest of /api/lms/*. The builder runs on its own
 * origin and its own session, but it is not a different protocol: an agent that
 * later writes courses (H3) calls exactly these routes.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { listBuilderCourses } from "@/lib/lms/builder";
import { courseFilterFor, resolveBuilderIdentity } from "@/lib/lms/builderAccess";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const identity = await resolveBuilderIdentity(user);

  try {
    const courses = await listBuilderCourses(courseFilterFor(identity));
    return NextResponse.json({ courses, isAdmin: identity.isAdmin });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
