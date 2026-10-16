/** DELETE /api/feed/marks/:clientId — removes one of the reader's own marks. */

import type { NextRequest } from "next/server";

import { ok, withRoute } from "@/lib/api/route";
import { FEED_READER_WRITE, feedDb, writer } from "@/lib/feed/http";
import { deleteFeedMark } from "@/lib/feed/server";

export const runtime = "nodejs";

export const DELETE = withRoute<{ clientId: string }>("feed.mark.remove", async (req: NextRequest, { params }) => {
  const { clientId } = await params;
  const user = await writer(req, FEED_READER_WRITE);
  if (!user.ok) return user.response;
  await deleteFeedMark(feedDb(), user.value.id, clientId);
  return ok({ ok: true });
});
