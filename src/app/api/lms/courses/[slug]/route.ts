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
import { isDenied, resolveCourseAccess } from "@/lib/lms/courseAccess";
import { buildOutline, foldProgress, resolveCurrentLesson, summarizeStanding } from "@/lms-core";

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
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
      enrollment: { startedAt: now, source: "builder_preview" },
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
  const learner = { startedAt: enrollment.startedAt, timeZone, now };
  // Preview must let the author inspect every lesson regardless of drip or
  // sequence, while keeping the authored schedule mode visible in the DTO.
  const navigableCourse = draftPreview ? { ...course, schedule: { ...course.schedule, mode: "open" as const } } : course;

  const outline = buildOutline(navigableCourse, progress, learner).map((entry) => ({
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
    standing: summarizeStanding(navigableCourse, progress, learner),
    currentLessonSlug: resolveCurrentLesson(navigableCourse, progress, learner)?.slug ?? null,
    outline,
  });
}
