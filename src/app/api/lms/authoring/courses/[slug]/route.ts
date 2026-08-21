/**
 * GET  /api/lms/authoring/courses/:slug — the full authored course, from the DB.
 * PUT  /api/lms/authoring/courses/:slug — write it back.
 *
 * The PUT body is a whole Course, not a patch. That is deliberate and it is the
 * shape the contract already has: `writeCourseStructure` validates a complete
 * course, the readiness gate reasons about a complete course, and a patch API
 * would need a second, weaker validator for half a course — the exact "two ways
 * to write" the authoring pipeline exists to prevent.
 *
 * A course this identity may not edit answers 404, not 403: whether a course
 * exists is not information an unauthorised caller is owed.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { loadBuilderCourse, saveBuilderCourse } from "@/lib/lms/builder";
import { canEditCourse, resolveBuilderIdentity } from "@/lib/lms/builderAccess";
import { courseReadiness } from "@/lms-core";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const identity = await resolveBuilderIdentity(user);

  try {
    const loaded = await loadBuilderCourse(slug);
    if (!loaded || !canEditCourse(identity, loaded.authorId)) {
      return NextResponse.json({ error: "course_not_found" }, { status: 404 });
    }

    const readiness = courseReadiness(loaded.course);
    return NextResponse.json({
      course: loaded.course,
      updatedAt: loaded.updatedAt,
      readiness: { ready: readiness.ready, blockers: readiness.blockers },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const identity = await resolveBuilderIdentity(user);

  const existing = await loadBuilderCourse(slug).catch(() => null);
  if (!existing || !canEditCourse(identity, existing.authorId)) {
    return NextResponse.json({ error: "course_not_found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as { course?: unknown } | null;
  if (!body?.course) return NextResponse.json({ error: "missing_course" }, { status: 400 });

  // The slug in the path wins over the slug in the body: a payload that renamed
  // the course would otherwise write a DIFFERENT course than the one whose
  // permissions were just checked.
  const incoming = { ...(body.course as Record<string, unknown>), slug };

  try {
    const result = await saveBuilderCourse(incoming);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    // Validation and gate failures are the author's to fix, not server faults.
    const isAuthorError = message.startsWith("lms_");
    return NextResponse.json({ error: message }, { status: isAuthorError ? 422 : 500 });
  }
}
