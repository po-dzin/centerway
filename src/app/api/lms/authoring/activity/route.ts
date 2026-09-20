/**
 * GET /api/lms/authoring/activity — the author's own change journal.
 *
 * The dashboard's fourth question is «що я нещодавно змінював?», and this is
 * the only route that can answer it honestly: `lms_course_revisions` is
 * server-only (no `anon`/`authenticated` grants at all), so a client cannot
 * read it and nothing else in the builder holds a cross-course view of it.
 *
 * SCOPED BY THE SAME FILTER THE SHELF USES. The ids come from
 * `courseFilterFor(identity)`, so an author sees the journal of their own
 * courses and an admin sees the house's — the identical boundary
 * `/api/lms/authoring/courses` draws, rather than a second opinion about who
 * owns what.
 */

import { NextRequest, NextResponse } from "next/server";

import { listBuilderCourseIdentities } from "@/lib/lms/builder";
import { courseFilterFor } from "@/lib/lms/builderAccess";
import { withBuilderIdentity } from "@/lib/lms/courseAccess";
import { LMS_AUTHORING_READ } from "@/lib/lms/rateRules";
import { listRecentCourseRevisions } from "@/lib/lms/revisions";

export const runtime = "nodejs";

/** Enough to read as a recent history, short enough to stay one screen. */
const ACTIVITY_LIMIT = 12;

export async function GET(req: NextRequest) {
  return withBuilderIdentity(
    req,
    async (identity) => {
      try {
        const courses = await listBuilderCourseIdentities(courseFilterFor(identity));
        const byId = new Map(courses.map((course) => [course.id, course] as const));
        const revisions = await listRecentCourseRevisions(
          courses.map((course) => course.id),
          ACTIVITY_LIMIT,
        );
        return NextResponse.json({
          /* The course is named here rather than in the component, because the
           id is the only thing the journal carries and the component has no
           business joining two lists to find out which course a line is
           about. An entry whose course has since been deleted is dropped: a
           row about nothing is not history, it is a dangling pointer. */
          activity: revisions.flatMap((revision) => {
            const course = byId.get(revision.courseId);
            if (!course) return [];
            return [
              {
                id: revision.id,
                slug: course.slug,
                courseTitle: course.title,
                revisionNumber: revision.revisionNumber,
                kind: revision.kind,
                label: revision.label,
                /* Who did it, by name — already shown to the same author in the
               course's own version history, so this moves no boundary. It is
               what makes «Опубліковано» read as an approval rather than as
               something that happened to the course on its own. */
                actor: revision.actor,
                createdAt: revision.createdAt,
              },
            ];
          }),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown_error";
        return NextResponse.json({ error: message }, { status: 500 });
      }
    },
    LMS_AUTHORING_READ,
  );
}
