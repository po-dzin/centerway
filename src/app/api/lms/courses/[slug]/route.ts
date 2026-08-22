/**
 * GET /api/lms/courses/:slug — the learner's course map.
 *
 * Bearer-authenticated on purpose: this is the same contract a native app or a
 * Telegram Mini App will call. If the cabinet could only be read through React
 * Server Components, a second client would mean a second implementation
 * (docs/lms-research-2026-08-15.md §5A).
 *
 * Returns outline + lock state + progress, never lesson bodies.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { loadLearnerCourse } from "@/lib/lms/server";
import { buildOutline, resolveCurrentLesson, summarizeStanding } from "@/lms-core";

export const runtime = "nodejs";

const FAILURE_STATUS: Record<string, number> = {
  course_not_found: 404,
  not_published: 404,
  not_entitled: 403,
  expired: 403,
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const now = new Date();

  const result = await loadLearnerCourse({ authUserId: user.id, email: user.email ?? null, emailVerified: Boolean(user.email_confirmed_at) }, slug, now);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: FAILURE_STATUS[result.reason] ?? 400 });
  }

  const { course, enrollment, progress, timeZone } = result.context;
  const learner = { startedAt: enrollment.startedAt, timeZone, now };

  const outline = buildOutline(course, progress, learner).map((entry) => ({
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
  }));

  return NextResponse.json({
    course: {
      slug: course.slug,
      title: course.title,
      version: course.version,
      locale: course.locale,
      scheduleMode: course.schedule.mode,
      summary: course.summary ?? null,
      // The gamma the author chose, travelling with the course rather than
      // being looked up again: it is one field and the client needs it before
      // the first paint, so a second request for it would be a flash of the
      // wrong palette.
      theme: course.theme ?? null,
    },
    enrollment: {
      startedAt: enrollment.startedAt.toISOString(),
      source: enrollment.source,
      timeZone,
    },
    standing: summarizeStanding(course, progress, learner),
    currentLessonSlug: resolveCurrentLesson(course, progress, learner)?.slug ?? null,
    outline,
  });
}
