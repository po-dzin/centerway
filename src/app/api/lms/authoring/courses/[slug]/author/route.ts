/**
 * GET   /api/lms/authoring/courses/:slug/author — the byline attached to this
 *       course, plus the caller's own author profile (if any).
 * PATCH /api/lms/authoring/courses/:slug/author — attach or clear it.
 *
 * WHO MAY NAME WHOM. An ordinary editor has two moves and no picker:
 * `attach-self` (their own `lms_authors` row) and `detach`. That is enough for
 * the common case — an author writing their own course — without opening a
 * route that would let one authenticated editor print anyone's name on any
 * course they can reach.
 *
 * An admin has a third, `attach-profile`, which takes an explicit
 * `authorProfileId`. It exists because the first two are NOT symmetric for
 * them: an admin can edit every course, so `attach-self` on someone else's
 * course replaces that person's byline with their own — and with only
 * `attach-self` and `detach` on offer there is then no way back to the author
 * who was there. Reassignment is the undo. It stays admin-only, checked here
 * against `identity.isAdmin`, because the reason not to hand it to everyone is
 * unchanged.
 */

import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import {
  AUTHOR_LIST_TAG,
  getAuthorProfileForUser,
  getCourseAuthor,
  getCourseAuthorProfileId,
  linkCourseAuthorProfile,
  listAuthorProfiles,
} from "@/lib/lms/authors";
import { withCourseAccess } from "@/lib/lms/courseAccess";
import { PURGE, courseTag } from "@/lib/lms/liveCatalog";
import { LMS_AUTHORING_READ, LMS_COURSE_WRITE } from "@/lib/lms/rateRules";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return withCourseAccess(
    req,
    slug,
    async (grant) => {
      const [ownProfile, linkedAuthor, linkedAuthorId, assignableAuthors] = await Promise.all([
        getAuthorProfileForUser(grant.identity.authUserId),
        getCourseAuthor(slug),
        getCourseAuthorProfileId(grant.courseId),
        // The roster travels only to the identity allowed to act on it, so the
        // builder never has to decide whether to draw a control it may not use.
        grant.identity.isAdmin ? listAuthorProfiles() : Promise.resolve([]),
      ]);

      return NextResponse.json({
        eligible: ownProfile.eligible,
        ownAuthor: ownProfile.author,
        linkedAuthor,
        linkedAuthorId,
        mayAssign: grant.identity.isAdmin,
        assignableAuthors,
      });
    },
    LMS_AUTHORING_READ,
  );
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return withCourseAccess(
    req,
    slug,
    async (grant) => {
      const body = (await req.json().catch(() => null)) as { action?: unknown; authorProfileId?: unknown } | null;
      const action = body?.action;
      if (action !== "attach-self" && action !== "detach" && action !== "attach-profile") {
        return NextResponse.json({ error: "lms_author_link_invalid_action" }, { status: 400 });
      }

      let authorProfileId: string | null = null;
      if (action === "attach-self") {
        const own = await getAuthorProfileForUser(grant.identity.authUserId);
        if (!own.author) {
          return NextResponse.json({ error: "lms_author_profile_missing" }, { status: 422 });
        }
        authorProfileId = own.author.id;
      }
      if (action === "attach-profile") {
        if (!grant.identity.isAdmin) {
          return NextResponse.json({ error: "lms_author_link_forbidden" }, { status: 403 });
        }
        const requested = typeof body?.authorProfileId === "string" ? body.authorProfileId : null;
        // Checked against the roster rather than trusted: an id that names no
        // profile would write a dangling foreign key, or silently a null byline.
        const known = requested ? (await listAuthorProfiles()).some((author) => author.id === requested) : false;
        if (!known) {
          return NextResponse.json({ error: "lms_author_profile_unknown" }, { status: 422 });
        }
        authorProfileId = requested;
      }

      const result = await linkCourseAuthorProfile(grant.courseId, authorProfileId);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

      revalidateTag(courseTag(slug), PURGE);
      revalidateTag(AUTHOR_LIST_TAG, PURGE);

      const linkedAuthor = await getCourseAuthor(slug);
      return NextResponse.json({ linkedAuthor, linkedAuthorId: authorProfileId });
    },
    LMS_COURSE_WRITE,
  );
}
