/**
 * GET   /api/lms/authoring/courses/:slug/author — the byline attached to this
 *       course, plus the caller's own author profile (if any).
 * PATCH /api/lms/authoring/courses/:slug/author — attach or clear it.
 *
 * WHY NOT AN ARBITRARY `authorProfileId` IN THE BODY. There is no picker for
 * "whose byline is this" — see `linkCourseAuthorProfile` in
 * `src/lib/lms/authors.ts`. The only two moves this route accepts are
 * `attach-self` (the signed-in editor's own `lms_authors` row) and `detach`.
 * That is enough for the common case — an author writing their own course —
 * without opening a route that would let one authenticated editor print
 * anyone's name on any course they can reach.
 */

import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import {
  AUTHOR_LIST_TAG,
  getAuthorProfileForUser,
  getCourseAuthor,
  getCourseAuthorProfileId,
  linkCourseAuthorProfile,
} from "@/lib/lms/authors";
import { withCourseAccess } from "@/lib/lms/courseAccess";
import { PURGE, courseTag } from "@/lib/lms/liveCatalog";
import { LMS_AUTHORING_READ, LMS_COURSE_WRITE } from "@/lib/lms/rateRules";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return withCourseAccess(req, slug, async (grant) => {
    const [ownProfile, linkedAuthor, linkedAuthorId] = await Promise.all([
      getAuthorProfileForUser(grant.identity.authUserId),
      getCourseAuthor(slug),
      getCourseAuthorProfileId(grant.courseId),
    ]);

    return NextResponse.json({
      eligible: ownProfile.eligible,
      ownAuthor: ownProfile.author,
      linkedAuthor,
      linkedAuthorId,
    });
  }, LMS_AUTHORING_READ);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return withCourseAccess(req, slug, async (grant) => {
    const body = (await req.json().catch(() => null)) as { action?: unknown } | null;
    const action = body?.action;
    if (action !== "attach-self" && action !== "detach") {
      return NextResponse.json({ error: "lms_author_link_invalid_action" }, { status: 400 });
    }

    const own = await getAuthorProfileForUser(grant.identity.authUserId);

    let authorProfileId: string | null = null;
    if (action === "attach-self") {
      if (!own.author) {
        return NextResponse.json({ error: "lms_author_profile_missing" }, { status: 422 });
      }
      authorProfileId = own.author.id;
    }

    const result = await linkCourseAuthorProfile(grant.courseId, authorProfileId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

    revalidateTag(courseTag(slug), PURGE);
    revalidateTag(AUTHOR_LIST_TAG, PURGE);

    const linkedAuthor = await getCourseAuthor(slug);
    return NextResponse.json({ linkedAuthor, linkedAuthorId: authorProfileId });
  }, LMS_COURSE_WRITE);
}
