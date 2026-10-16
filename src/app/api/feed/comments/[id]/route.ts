/** DELETE /api/feed/comments/:id — the writer deletes it, or the post's author hides it. */

import type { NextRequest } from "next/server";

import { ok, withRoute } from "@/lib/api/route";
import { FEED_READER_WRITE, feedDb, refusal, writer } from "@/lib/feed/http";
import { removeComment } from "@/lib/feed/server";

export const runtime = "nodejs";

export const DELETE = withRoute<{ id: string }>("feed.comment.remove", async (req: NextRequest, { params }) => {
  const { id } = await params;
  const user = await writer(req, FEED_READER_WRITE);
  if (!user.ok) return user.response;
  try {
    await removeComment(feedDb(), id, user.value.id);
    return ok({ ok: true });
  } catch (error) {
    return refusal(error);
  }
});
