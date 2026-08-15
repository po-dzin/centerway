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
import {
  canCompleteLesson,
  collectRequiredChecklistItemIds,
  findLesson,
  lessonAvailability,
  lessonProgressOf,
} from "@/lms-core";

export const runtime = "nodejs";

const FAILURE_STATUS: Record<string, number> = {
  course_not_found: 404,
  not_published: 404,
  not_entitled: 403,
  expired: 403,
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; lessonSlug: string }> }
) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug, lessonSlug } = await params;
  const now = new Date();

  const result = await loadLearnerCourse({ authUserId: user.id, email: user.email ?? null }, slug, now);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: FAILURE_STATUS[result.reason] ?? 400 });
  }

  const { course, enrollment, progress, timeZone } = result.context;
  const found = findLesson(course, lessonSlug);
  if (!found) return NextResponse.json({ error: "lesson_not_found" }, { status: 404 });

  const learner = { startedAt: enrollment.startedAt, timeZone, now };
  const availability = lessonAvailability(course, found.lesson, progress, learner);

  if (!availability.available) {
    // Locked lessons return their unlock reason, never their content.
    return NextResponse.json({ error: "lesson_locked", availability }, { status: 423 });
  }

  const lessonProgress = lessonProgressOf(progress, found.lesson.id);

  if (lessonProgress.status === "not_started") {
    await recordProgressEvent({
      enrollmentId: enrollment.id,
      lessonId: found.lesson.id,
      type: "lesson.started",
      // Server-side idempotency key: one "started" per enrollment+lesson.
      clientId: `srv:start:${found.lesson.id}`,
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
    progress: {
      status: lessonProgress.status === "not_started" ? "started" : lessonProgress.status,
      checklist: lessonProgress.checklist,
      completedAt: lessonProgress.completedAt,
    },
    requiredChecklistItemIds: collectRequiredChecklistItemIds(found.lesson.blocks),
    completion: canCompleteLesson(course, found.lesson, progress, learner),
  });
}
