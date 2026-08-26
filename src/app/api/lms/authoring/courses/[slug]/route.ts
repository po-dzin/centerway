/**
 * GET    /api/lms/authoring/courses/:slug — the full authored course, from the DB.
 * PUT    /api/lms/authoring/courses/:slug — write it back.
 * PATCH  /api/lms/authoring/courses/:slug — rename an unused draft address.
 * DELETE /api/lms/authoring/courses/:slug — remove it, if nothing is owed to anyone.
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

import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { builderCourseSlugCanChange, deleteBuilderCourse, isDraftGeneration, loadBuilderCourse, renameBuilderCourseSlug, saveBuilderCourse } from "@/lib/lms/builder";
import { COURSE_LIST_TAG, PURGE, courseTag } from "@/lib/lms/liveCatalog";
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
      liveStatus: loaded.liveStatus,
      hasPendingRevision: loaded.hasPendingRevision,
      draftGeneration: loaded.draftGeneration,
      updatedAt: loaded.updatedAt,
      readiness: { ready: readiness.ready, blockers: readiness.blockers },
      review: {
        status: loaded.reviewStatus,
        note: loaded.reviewNote,
        enabled: loaded.reviewEnabled,
      },
      slugEditable: await builderCourseSlugCanChange({ course: loaded.course, reviewStatus: loaded.reviewStatus }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    // A stored course can fail the same LMS contract as an incoming save. That
    // is invalid authored content, not a lost server connection; classifying
    // it as 422 lets the Builder show the recovery state instead of a network
    // error with an internal validation code.
    return NextResponse.json({ error: message }, { status: message.startsWith("lms_") ? 422 : 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const identity = await resolveBuilderIdentity(user);
  const existing = await loadBuilderCourse(slug).catch(() => null);
  if (!existing || !canEditCourse(identity, existing.authorId)) {
    return NextResponse.json({ error: "course_not_found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as { slug?: unknown } | null;
  if (typeof body?.slug !== "string" || body.slug.trim() === "") {
    return NextResponse.json({ error: "lms_builder_missing_slug" }, { status: 422 });
  }

  try {
    const result = await renameBuilderCourseSlug(slug, body.slug);
    revalidateTag(courseTag(slug), PURGE);
    revalidateTag(courseTag(result.slug), PURGE);
    revalidateTag(COURSE_LIST_TAG, PURGE);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const isAuthorError = message.startsWith("lms_");
    return NextResponse.json({ error: message }, { status: isAuthorError ? 422 : 500 });
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

  const body = (await req.json().catch(() => null)) as { course?: unknown; expectedGeneration?: unknown } | null;
  if (!body?.course) return NextResponse.json({ error: "missing_course" }, { status: 400 });
  if (!isDraftGeneration(body.expectedGeneration)) {
    return NextResponse.json({ error: "lms_builder_invalid_draft_generation" }, { status: 422 });
  }

  // The slug in the path wins over the slug in the body: a payload that renamed
  // the course would otherwise write a DIFFERENT course than the one whose
  // permissions were just checked.
  const incoming = { ...(body.course as Record<string, unknown>), slug };

  try {
    const result = await saveBuilderCourse(incoming, body.expectedGeneration);
    // The learner reads this course through a tagged cache, so the write has to
    // drop the entry or a publish would sit behind the TTL. This is the line
    // that makes "опублікувати" mean it.
    revalidateTag(courseTag(slug), PURGE);
    revalidateTag(COURSE_LIST_TAG, PURGE);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    if (message === "lms_builder_draft_conflict") {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    // Validation and gate failures are the author's to fix, not server faults.
    const isAuthorError = message.startsWith("lms_");
    return NextResponse.json({ error: message }, { status: isAuthorError ? 422 : 500 });
  }
}

/**
 * Removes a course.
 *
 * The refusals live in `deleteBuilderCourse` — published, enrolled, or walked
 * by anyone — and come back as `lms_builder_delete_*` codes rather than as a
 * flat 403, because "you cannot delete this" and "you cannot delete this
 * BECAUSE forty people are halfway through it" are different sentences and only
 * the second one tells the author what to do instead.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const identity = await resolveBuilderIdentity(user);

  const existing = await loadBuilderCourse(slug).catch(() => null);
  if (!existing || !canEditCourse(identity, existing.authorId)) {
    return NextResponse.json({ error: "course_not_found" }, { status: 404 });
  }

  try {
    await deleteBuilderCourse(slug);
    revalidateTag(courseTag(slug), PURGE);
    revalidateTag(COURSE_LIST_TAG, PURGE);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const isAuthorError = message.startsWith("lms_");
    return NextResponse.json({ error: message }, { status: isAuthorError ? 422 : 500 });
  }
}
