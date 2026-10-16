/**
 * /api/feed — «Стрічка».
 *
 * GET  the published feed, newest first: `?topic=a,b&author=slug&before=<iso>`.
 *      Open to everyone; a Bearer token only adds the reader's own reactions.
 * POST a new post from a listed author: `{ body, topic, courseId?, lessonId?,
 *      blockId?, blockDisplay? }`. Passed the check — published; stopped — held,
 *      and the card goes to the team's group after the answer.
 */

import { after, type NextRequest } from "next/server";

import { ok, withRoute } from "@/lib/api/route";
import { authorWriter, feedDb, jsonBody, refusal, viewerOf } from "@/lib/feed/http";
import { parseFeedFilter } from "@/lib/feed/model";
import { createFeedPost, listFeed } from "@/lib/feed/server";
import { sendHeldPostCard } from "@/lib/feed/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withRoute("feed.list", async (req) => {
  const params = req.nextUrl.searchParams;
  const viewer = await viewerOf(req);
  const before = params.get("before");
  const page = await listFeed(feedDb(), {
    filter: parseFeedFilter({ topic: params.get("topic"), author: params.get("author") }),
    before: before && !Number.isNaN(Date.parse(before)) ? before : null,
    me: viewer?.id ?? null,
  });
  return ok(page);
});

export const POST = withRoute("feed.create", async (req: NextRequest) => {
  const db = feedDb();
  const author = await authorWriter(req, db);
  if (!author.ok) return author.response;
  try {
    const created = await createFeedPost(db, author.value, await jsonBody(req));
    if (created.post.status === "held") after(() => sendHeldPostCard(db, created.post.id));
    return ok({ post: created.post, findings: created.verdict.findings }, { status: 201 });
  } catch (error) {
    return refusal(error);
  }
});
