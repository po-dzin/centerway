/**
 * /api/feed/:id — one post.
 *
 * GET    published for everyone; the author also sees their own held or returned post.
 * PATCH  the author sends a returned post again, edited: `{ body, topic }`.
 * DELETE the author removes their own post.
 */

import { after, type NextRequest } from "next/server";

import { fail, ok, withRoute } from "@/lib/api/route";
import { authorWriter, feedDb, jsonBody, refusal, viewerOf } from "@/lib/feed/http";
import { deleteFeedPost, getFeedPost, resubmitFeedPost } from "@/lib/feed/server";
import { sendHeldPostCard } from "@/lib/feed/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { id: string };

export const GET = withRoute<Params>("feed.get", async (req, { params }) => {
  const { id } = await params;
  const viewer = await viewerOf(req);
  const post = await getFeedPost(feedDb(), id, viewer?.id ?? null);
  return post ? ok({ post }) : fail(404, "not_found");
});

export const PATCH = withRoute<Params>("feed.resubmit", async (req: NextRequest, { params }) => {
  const { id } = await params;
  const db = feedDb();
  const author = await authorWriter(req, db);
  if (!author.ok) return author.response;
  try {
    const created = await resubmitFeedPost(db, author.value, id, await jsonBody(req));
    if (created.post.status === "held") after(() => sendHeldPostCard(db, created.post.id));
    return ok({ post: created.post, findings: created.verdict.findings });
  } catch (error) {
    return refusal(error);
  }
});

export const DELETE = withRoute<Params>("feed.delete", async (req: NextRequest, { params }) => {
  const { id } = await params;
  const db = feedDb();
  const author = await authorWriter(req, db);
  if (!author.ok) return author.response;
  await deleteFeedPost(db, author.value, id);
  return ok({ ok: true });
});
