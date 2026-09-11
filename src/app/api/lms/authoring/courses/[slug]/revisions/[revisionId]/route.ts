import { NextRequest, NextResponse } from "next/server";

import { diffCourses } from "@/lms-core";
import { loadBuilderCourse } from "@/lib/lms/builder";
import { withCourseAccess } from "@/lib/lms/courseAccess";
import { LMS_AUTHORING_READ } from "@/lib/lms/rateRules";
import { loadCourseRevision } from "@/lib/lms/revisions";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string; revisionId: string }> }) {
  const { slug, revisionId } = await params;

  return withCourseAccess(
    req,
    slug,
    async (grant) => {
      try {
        const revision = await loadCourseRevision(grant.courseId, revisionId);
        if (!revision) return NextResponse.json({ error: "revision_not_found" }, { status: 404 });

        /* Разница считается ЗДЕСЬ и не хранится — так решено в
         docs/lms-course-version-history-2026-08-23.md. Сравниваем с тем
         документом, который автор сейчас видит в билдере: вопрос перед
         восстановлением звучит «чем та версия отличается от нынешней», а не
         «чем она отличалась от соседней по журналу».

         Сравнение — вспомогательное: если текущий документ почему-то не
         читается, версию всё равно надо показать. */
        let diff = null;
        try {
          const current = await loadBuilderCourse(revision.content.slug);
          if (current) diff = diffCourses(revision.content, current.course);
        } catch (error) {
          console.warn(`lms: revision diff unavailable for ${revisionId}`, error);
        }

        return NextResponse.json({ revision, diff });
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown_error";
        return NextResponse.json({ error: message }, { status: message.startsWith("lms_") ? 422 : 500 });
      }
    },
    LMS_AUTHORING_READ,
  );
}
