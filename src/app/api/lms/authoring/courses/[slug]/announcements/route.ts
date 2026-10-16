/**
 * GET  /api/lms/authoring/courses/:slug/announcements — who would receive one
 *      now, when the next may go, and what was sent before (counts only).
 * POST /api/lms/authoring/courses/:slug/announcements — send one.
 *
 * Counts and nothing else cross to the author, the same rule as
 * `/api/lms/authoring/audience`: how many received it, never who. The lessons
 * offered for the button are the LIVE release's, the ones learners can open.
 * See `src/lib/lms/announcements.ts`.
 */

import { after, NextRequest, NextResponse } from "next/server";

import {
  AnnouncementError,
  courseLessonTitles,
  createAnnouncement,
  lastAnnouncementAt,
  listCourseAnnouncements,
  nextAnnouncementAt,
  readAnnouncementReach,
  sendAnnouncementBatch,
} from "@/lib/lms/announcements";
import { withCourseAccess } from "@/lib/lms/courseAccess";
import { LMS_AUTHORING_READ, LMS_COURSE_WRITE } from "@/lib/lms/rateRules";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return withCourseAccess(
    req,
    slug,
    async (grant) => {
      try {
        const { liveCourse } = await grant.load();
        const [reach, announcements, last] = await Promise.all([
          readAnnouncementReach(liveCourse),
          listCourseAnnouncements(liveCourse),
          lastAnnouncementAt(liveCourse.id),
        ]);
        return NextResponse.json({
          reach,
          nextAt: nextAnnouncementAt(last, new Date()),
          lessons: [...courseLessonTitles(liveCourse)].map(([lessonSlug, title]) => ({ slug: lessonSlug, title })),
          announcements,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown_error";
        return NextResponse.json({ error: message }, { status: 500 });
      }
    },
    LMS_AUTHORING_READ,
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return withCourseAccess(
    req,
    slug,
    async (grant) => {
      const body = (await req.json().catch(() => null)) as { body?: unknown; lessonSlug?: unknown } | null;
      try {
        const { liveCourse } = await grant.load();
        const created = await createAnnouncement({
          course: liveCourse,
          createdBy: grant.identity.authUserId,
          body: body?.body,
          lessonSlug: body?.lessonSlug ?? null,
        });
        // The first batch goes out as soon as the author has their answer; the
        // queued job carries whatever this does not reach.
        after(async () => {
          await sendAnnouncementBatch(created.id).catch((error) =>
            console.error("lms_announcement_first_batch_failed", {
              id: created.id,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        });
        return NextResponse.json(created, { status: 201 });
      } catch (error) {
        if (error instanceof AnnouncementError) {
          return NextResponse.json({ error: error.code, ...error.extra }, { status: error.status });
        }
        const message = error instanceof Error ? error.message : "unknown_error";
        return NextResponse.json({ error: message }, { status: 500 });
      }
    },
    LMS_COURSE_WRITE,
  );
}
