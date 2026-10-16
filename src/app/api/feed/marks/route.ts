/**
 * /api/feed/marks — «Позначити» / «Нотатка» on feed posts, the reader's own.
 *
 * GET  `?post=id,id` the reader's marks on those posts (to paint them).
 * POST `{ clientId, postId, quote, prefix?, start?, end?, note? }` writes one;
 *      the same clientId again replaces it. They appear in «Мій журнал».
 */

import type { NextRequest } from "next/server";

import { fail, ok, withRoute } from "@/lib/api/route";
import { FEED_READER_WRITE, feedDb, jsonBody, refusal, viewerOf, writer } from "@/lib/feed/http";
import { listFeedMarks, saveFeedMark } from "@/lib/feed/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withRoute("feed.marks", async (req: NextRequest) => {
  const viewer = await viewerOf(req);
  if (!viewer) return fail(401, "unauthorized");
  const ids = (req.nextUrl.searchParams.get("post") ?? "").split(",").filter(Boolean).slice(0, 50);
  return ok({ marks: await listFeedMarks(feedDb(), viewer.id, ids) });
});

export const POST = withRoute("feed.mark", async (req: NextRequest) => {
  const user = await writer(req, FEED_READER_WRITE);
  if (!user.ok) return user.response;
  try {
    return ok({ mark: await saveFeedMark(feedDb(), user.value.id, await jsonBody(req)) });
  } catch (error) {
    return refusal(error);
  }
});
