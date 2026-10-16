/**
 * GET /api/feed/me — what the signed-in account may do in the feed.
 *
 * `{ author: null }` for a reader. For a listed author: their byline, their own
 * posts in every state («Мої дописи»), and their programmes with lessons and
 * blocks for «+ Блок з програми».
 */

import type { NextRequest } from "next/server";

import { fail, ok, withRoute } from "@/lib/api/route";
import { feedDb, viewerOf } from "@/lib/feed/http";
import { feedAuthorForUser, listComposerCourses, listOwnPosts } from "@/lib/feed/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withRoute("feed.me", async (req: NextRequest) => {
  const viewer = await viewerOf(req);
  if (!viewer) return fail(401, "unauthorized");
  const db = feedDb();
  const author = await feedAuthorForUser(db, viewer.id);
  if (!author) return ok({ author: null, posts: [], courses: [] });
  const [posts, courses] = await Promise.all([listOwnPosts(db, author), listComposerCourses(db, author)]);
  return ok({ author: { id: author.id, slug: author.slug, name: author.name, photo: author.photo }, posts, courses });
});
