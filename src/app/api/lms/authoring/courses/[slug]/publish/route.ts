import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { moderateCourse } from "@/lib/admin/access/courses";
import { submitBuilderCourseForReview } from "@/lib/lms/builder";
import { withCourseAccess } from "@/lib/lms/courseAccess";
import { COURSE_LIST_TAG, PURGE, courseTag } from "@/lib/lms/liveCatalog";
import { LMS_COURSE_WRITE } from "@/lib/lms/rateRules";

/**
 * PUBLISH WITHOUT LEAVING THE BUILDER — for the people who would approve it
 * anyway.
 *
 * Review exists so that a second pair of eyes sees an author's material before
 * learners do. It does not exist to make the platform's own staff walk to
 * another surface to approve their own edit: an admin editing a course was
 * submitting a revision to a queue that only they could clear, then opening the
 * admin panel to clear it. Two screens and a queue for one decision that had
 * already been made.
 *
 * So this is the same two steps, taken together, and only by an identity that
 * could take the second one on its own: submit, then approve. An author's
 * request is refused here and goes to the queue as before — the gate is
 * `identity.isAdmin`, which is the same flag the moderation route checks.
 *
 * The cache purge is not an afterthought. `moderateCourse` writes the release
 * and nothing else; the storefront reads through tagged caches, so without
 * these two lines the course is published and the page still shows yesterday's
 * material — which is precisely the failure this endpoint was added to end.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return withCourseAccess(
    req,
    slug,
    async (grant) => {
      if (!grant.identity.isAdmin) {
        return NextResponse.json({ error: "lms_publish_requires_admin" }, { status: 403 });
      }

      try {
        const loaded = await grant.load();
        /* Already in the queue — the submit step would refuse a second time,
           and there is nothing to submit. Approving is the whole request. */
        if (loaded.reviewStatus !== "in_review") {
          /* `isAdmin` is not a guess here either — this whole route is
             refused above to anyone else — and it is what keeps publishing
             from inside the builder from announcing a review that nobody is
             waiting on: the next line approves it. */
          await submitBuilderCourseForReview(slug, grant.identity.authUserId, {
            isAdmin: true,
            email: grant.identity.email,
          });
        }
        await moderateCourse({
          courseId: loaded.course.id,
          actorId: grant.identity.authUserId,
          action: "approve",
        });

        revalidateTag(courseTag(slug), PURGE);
        revalidateTag(COURSE_LIST_TAG, PURGE);

        return NextResponse.json({ status: "published" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown_error";
        return NextResponse.json({ error: message }, { status: message.startsWith("lms_") ? 422 : 500 });
      }
    },
    LMS_COURSE_WRITE,
  );
}
