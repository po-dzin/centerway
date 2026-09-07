import { NextRequest, NextResponse } from "next/server";

import { withCourseAccess } from "@/lib/lms/courseAccess";
import { LMS_AUTHORING_READ, LMS_COURSE_WRITE } from "@/lib/lms/rateRules";
import { createCourseCheckpointOnce, listCourseRevisions, listLessonRevisions } from "@/lib/lms/revisions";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return withCourseAccess(req, slug, async (grant) => {
    try {
      /* `?lesson=` сужает историю курса до одного урока. Это ФИЛЬТР, а не
         вторая история: снимок остаётся курсовым, отдельной таблицы версий
         урока нет и не будет — см. `listLessonRevisions`. */
      const lessonId = req.nextUrl.searchParams.get("lesson");
      if (lessonId) {
        return NextResponse.json({ lessonRevisions: await listLessonRevisions(grant.courseId, lessonId) });
      }
      return NextResponse.json({ revisions: await listCourseRevisions(grant.courseId) });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "unknown_error" }, { status: 500 });
    }
  }, LMS_AUTHORING_READ);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return withCourseAccess(req, slug, async (grant) => {
    const body = (await req.json().catch(() => ({}))) as { label?: unknown };
    if (body.label !== undefined && (typeof body.label !== "string" || body.label.trim().length > 120)) {
      return NextResponse.json({ error: "lms_revision_invalid_label" }, { status: 422 });
    }
    try {
      const revision = await createCourseCheckpointOnce({
        course: (await grant.load()).course,
        actorId: grant.identity.authUserId,
        label: typeof body.label === "string" ? body.label : null,
      });
      // 200, а не 201, когда ничего не создано: код ответа не должен обещать
      // новую запись там, где вернулась уже существующая.
      return NextResponse.json({ revision }, { status: revision.created ? 201 : 200 });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "unknown_error" }, { status: 500 });
    }
  }, LMS_COURSE_WRITE);
}
