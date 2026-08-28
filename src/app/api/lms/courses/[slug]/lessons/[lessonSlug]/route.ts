/**
 * GET /api/lms/courses/:slug/lessons/:lessonSlug — one lesson body.
 *
 * Lesson blocks are served only when the learner is entitled AND the lesson is
 * unlocked, so a locked day cannot be read by guessing its URL. Marking the
 * lesson as started is a side effect of a successful read.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { loadLearnerCourse, recordProgressEvent } from "@/lib/lms/server";
import { isDenied, resolveCourseAccess } from "@/lib/lms/courseAccess";
import {
  buildOutline,
  buildInternalReferenceTargets,
  canCompleteLesson,
  collectRequiredChecklistItemIds,
  findLesson,
  foldProgress,
  lessonAvailability,
  lessonProgressOf,
} from "@/lms-core";

export const runtime = "nodejs";

const FAILURE_STATUS: Record<string, number> = {
  course_not_found: 404,
  not_published: 404,
  not_entitled: 403,
  expired: 403,
  // Closed by an operator rather than by the calendar. Same 403 to the caller —
  // the reason is for the notice, not for the status line.
  revoked: 403,
  blocked: 403,
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; lessonSlug: string }> }
) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug, lessonSlug } = await params;
  const now = new Date();
  const draftPreview = req.nextUrl.searchParams.get("preview") === "draft";

  let context;
  if (draftPreview) {
    // The preview is the AUTHORING permission asked from the learner's route,
    // so it asks the authoring module rather than re-deriving the rule here.
    const access = await resolveCourseAccess(user, slug);
    if (isDenied(access)) return NextResponse.json({ error: "course_not_found" }, { status: 404 });
    const loaded = await access.grant.load().catch(() => null);
    if (!loaded) return NextResponse.json({ error: "course_not_found" }, { status: 404 });
    context = {
      course: loaded.course,
      enrollment: { id: "builder-preview", startedAt: now },
      progress: foldProgress([]),
      timeZone: "Europe/Kyiv",
    };
  } else {
    const result = await loadLearnerCourse({ authUserId: user.id, email: user.email ?? null, emailVerified: Boolean(user.email_confirmed_at) }, slug, now);
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: FAILURE_STATUS[result.reason] ?? 400 });
    }
    context = result.context;
  }

  const { course, enrollment, progress, timeZone } = context;
  const navigableCourse = draftPreview ? { ...course, schedule: { ...course.schedule, mode: "open" as const } } : course;
  const found = findLesson(navigableCourse, lessonSlug);
  if (!found) return NextResponse.json({ error: "lesson_not_found" }, { status: 404 });

  const learner = { startedAt: enrollment.startedAt, timeZone, now };
  const availability = lessonAvailability(navigableCourse, found.lesson, progress, learner);

  if (!availability.available) {
    // Locked lessons return their unlock reason, never their content.
    return NextResponse.json({ error: "lesson_locked", availability }, { status: 423 });
  }

  const lessonProgress = lessonProgressOf(progress, found.lesson.id);

  // The whole course map travels with the lesson: the player needs it for the
  // contents drawer and for prev/next, and a course is small enough that a
  // second round trip would cost more than the payload.
  const outline = buildOutline(navigableCourse, progress, learner);

  // prev/next and "крок N з M" walk the STEPS only. Reference material sits
  // outside the flow, so opening a recipe never renumbers the protocol.
  const steps = outline.filter((entry) => !entry.isReference);
  const index = steps.findIndex((entry) => entry.lesson.id === found.lesson.id);
  const isReference = found.module.reference === true;

  const asNeighbour = (entry: (typeof outline)[number] | undefined) =>
    entry
      ? {
          slug: entry.lesson.slug,
          title: entry.lesson.title,
          available: entry.availability.available,
        }
      : null;

  // Every successful lesson open is real course activity, including a return
  // to an already started or completed lesson. A fresh id keeps that visit in
  // the append-only log; the fold preserves the original `startedAt` and never
  // un-completes a lesson, while advancing `lastActivityAt` for the dashboard.
  if (!draftPreview) {
    await recordProgressEvent({
      enrollmentId: enrollment.id,
      lessonId: found.lesson.id,
      type: "lesson.started",
      clientId: `srv:open:${found.lesson.id}:${crypto.randomUUID()}`,
      occurredAt: now.toISOString(),
    });
  }

  return NextResponse.json({
    lesson: {
      id: found.lesson.id,
      slug: found.lesson.slug,
      title: found.lesson.title,
      dayIndex: found.lesson.dayIndex ?? null,
      durationMin: found.lesson.durationMin ?? null,
      summary: found.lesson.summary ?? null,
      blocks: found.lesson.blocks,
    },
    module: { id: found.module.id, title: found.module.title },
    courseVersion: course.version,
    courseTheme: course.theme ?? null,
    // The crumb names the course, not its slug. One string, travelling with the
    // lesson rather than costing a second request before the first paint.
    courseTitle: course.title,
    referenceTargets: buildInternalReferenceTargets(course),
    progress: {
      status: lessonProgress.status === "not_started" ? "started" : lessonProgress.status,
      checklist: lessonProgress.checklist,
      completedAt: lessonProgress.completedAt,
    },
    requiredChecklistItemIds: collectRequiredChecklistItemIds(found.lesson.blocks),
    completion: canCompleteLesson(navigableCourse, found.lesson, progress, learner),
    isReference,
    nav: isReference
      ? // Reference pages have no place in the sequence: no counter, no pager.
        { position: null, total: steps.length, previous: null, next: null }
      : {
          // 1-based so the UI can say "крок 3 з 5" without arithmetic.
          position: index + 1,
          total: steps.length,
          previous: asNeighbour(index > 0 ? steps[index - 1] : undefined),
          next: asNeighbour(steps[index + 1]),
        },
    outline: outline.map((entry) => ({
      moduleId: entry.moduleId,
      moduleTitle: entry.moduleTitle,
      isReference: entry.isReference,
      lessonId: entry.lesson.id,
      slug: entry.lesson.slug,
      title: entry.lesson.title,
      dayIndex: entry.lesson.dayIndex ?? null,
      durationMin: entry.lesson.durationMin ?? null,
      completed: entry.completed,
      availability: entry.availability,
    })),
  });
}
