/**
 * /api/feed — «Стрічка».
 *
 * GET  the published feed, newest first: `?topic=a,b&author=slug&before=<iso>`;
 *      a topic matches a post that carries it among its topics.
 *      Open to everyone; a Bearer token only adds the reader's own reactions.
 * POST a new post from a listed author — or, with `asPlatform: true`, from an
 *      admin writing as CenterWay (published at once; `pinned: true` also pins it): `{ body, topics (1–3; or the old
 *      single `topic`), media?, taggedAuthorIds?, courseId?, lessonId?,
 *      blockId?, blockDisplay? }` — `media` is `{ photos?: [{ path, w, h,
 *      spoiler }], video?: { youtubeId } (or a link), audio?: { path,
 *      durationSec, mime } }` with paths from /api/feed/media. Passed the
 *      check — published; stopped — held, and the card goes to the team's
 *      group after the answer. A 4xx answers a code (`body_too_long`,
 *      `topic_invalid`, `media_*`, `tags_*`, `attachment_*`).
 */

import { after, type NextRequest } from "next/server";

import { ok, withRoute } from "@/lib/api/route";
import { feedDb, jsonBody, postingAuthor, refusal, viewerOf } from "@/lib/feed/http";
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
  const body = await jsonBody(req);
  const asPlatform = body.asPlatform === true;
  const author = await postingAuthor(req, db, asPlatform);
  if (!author.ok) return author.response;
  try {
    const created = await createFeedPost(db, author.value, body, new Date(), {
      platform: asPlatform,
      pinned: asPlatform && body.pinned === true,
    });
    if (created.post.status === "held") after(() => sendHeldPostCard(db, created.post.id));
    return ok({ post: created.post, findings: created.verdict.findings }, { status: 201 });
  } catch (error) {
    return refusal(error);
  }
});
