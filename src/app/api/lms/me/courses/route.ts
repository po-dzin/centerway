/**
 * GET /api/lms/me/courses — the learner's shelf for the cabinet.
 *
 * Same Bearer contract as the rest of /api/lms/*: the web cabinet, a native app
 * and a Mini App all read the shelf the same way (docs/lms-research-2026-08-15.md §5A).
 *
 * Read-only — opening the cabinet never starts a course clock.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { listLearnerCourses } from "@/lib/lms/server";
import { inlineToPlainText } from "@/lms-core";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const shelf = await listLearnerCourses({
    authUserId: user.id,
    email: user.email ?? null,
    emailVerified: Boolean(user.email_confirmed_at),
  });

  return NextResponse.json({
    courses: shelf.map((entry) => ({
      slug: entry.course.slug,
      title: entry.course.title,
      programSlug: entry.course.programSlug,
      status: entry.course.status,
      scheduleMode: entry.course.schedule.mode,
      summary: entry.course.summary ? inlineToPlainText(entry.course.summary) : null,
      access: entry.access,
      lockReason: entry.lockReason,
      startedAt: entry.startedAt,
      standing: entry.standing,
      currentLessonSlug: entry.currentLessonSlug,
      currentLessonTitle: entry.currentLessonTitle,
    })),
  });
}
