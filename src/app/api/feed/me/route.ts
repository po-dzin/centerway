/**
 * GET /api/feed/me — what the signed-in account may do in the feed.
 *
 * `{ author: null }` for a reader. For a listed author: their byline, their own
 * posts in every state («Мої дописи»), their programmes with lessons and
 * blocks for «+ Блок з програми», and `taggable` — every other listed author,
 * for the composer's «з …» menu.
 */

import type { NextRequest } from "next/server";

import { fail, ok, withRoute } from "@/lib/api/route";
import { feedDb, viewerOf } from "@/lib/feed/http";
import {
  feedAuthorForUser,
  feedPlatformAuthor,
  isFeedAdmin,
  listComposerCourses,
  listOwnPosts,
  listTaggableAuthors,
} from "@/lib/feed/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withRoute("feed.me", async (req: NextRequest) => {
  const viewer = await viewerOf(req);
  if (!viewer) return fail(401, "unauthorized");
  const db = feedDb();
  const author = await feedAuthorForUser(db, viewer.id);
  /* An admin may also write as the platform: its byline rides along. */
  const platform = (await isFeedAdmin(db, viewer.id)) ? await feedPlatformAuthor(db, viewer.id) : null;
  const platformOut = platform
    ? { id: platform.id, slug: platform.slug, name: platform.name, photo: platform.photo }
    : null;
  if (!author) return ok({ author: null, platform: platformOut, posts: [], courses: [], taggable: [] });
  const [posts, courses, taggable] = await Promise.all([
    listOwnPosts(db, author),
    listComposerCourses(db, author),
    listTaggableAuthors(db, author),
  ]);
  return ok({
    author: { id: author.id, slug: author.slug, name: author.name, photo: author.photo },
    platform: platformOut,
    posts,
    courses,
    taggable,
  });
});
