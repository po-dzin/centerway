/**
 * GET /api/feed/:id/go — where the arrow of a post's attachment leads THIS reader.
 *
 * A reader who has the course (enrolled and not closed, or its author or staff)
 * goes into it: the lesson, down to the block, or the course's own page for a
 * programme. Anyone else — a guest included — goes to the programme's page,
 * where it is bought. Answers `{ href, inside }`; `href` is a site path, which
 * the caller resolves against the surface it is on.
 */

import type { NextRequest } from "next/server";

import { fail, ok, withRoute } from "@/lib/api/route";
import { feedDb, viewerOf } from "@/lib/feed/http";
import { attachmentPath } from "@/lib/feed/attachment";
import { getFeedPost } from "@/lib/feed/server";
import { isDenied, resolveCourseAccess } from "@/lib/lms/courseAccess";
import { loadLearnerCourse } from "@/lib/lms/server";
import { requireUserFromBearer } from "@/lib/auth/requireUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { id: string };

export const GET = withRoute<Params>("feed.go", async (req: NextRequest, { params }) => {
  const { id } = await params;
  const viewer = await viewerOf(req);
  const post = await getFeedPost(feedDb(), id, viewer?.id ?? null);
  const attachment = post?.attachment;
  if (!post || !attachment) return fail(404, "not_found");

  let inside = false;
  const slug = attachment.courseSlug;
  if (viewer && slug) {
    const user = await requireUserFromBearer(req.headers.get("authorization"));
    if (user) {
      const learner = await loadLearnerCourse(
        { authUserId: user.id, email: user.email ?? null, emailVerified: Boolean(user.email_confirmed_at) },
        slug,
      );
      inside = learner.ok || !isDenied(await resolveCourseAccess(user, slug));
    }
  }
  const href = attachmentPath(attachment, inside);
  return href ? ok({ href, inside }) : fail(404, "not_found");
});
