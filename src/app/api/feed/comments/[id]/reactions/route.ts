import type { NextRequest } from "next/server";
import { ok, withRoute } from "@/lib/api/route";
import { FEED_READER_WRITE, feedDb, jsonBody, refusal, writer } from "@/lib/feed/http";
import { toggleCommentReaction } from "@/lib/feed/server";
export const runtime = "nodejs";
export const POST = withRoute<{ id: string }>("feed.comment.react", async (req: NextRequest, { params }) => {
  const { id } = await params;
  const user = await writer(req, FEED_READER_WRITE);
  if (!user.ok) return user.response;
  try {
    const body = await jsonBody(req);
    return ok({ reactions: await toggleCommentReaction(feedDb(), id, user.value.id, body.emoji) });
  } catch (error) {
    return refusal(error);
  }
});
