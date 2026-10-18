/**
 * POST /api/feed/:id/hide — an admin takes a post out of the feed without
 * deleting it. The row stays (`hidden_at`), so it can be brought back by hand.
 */

import type { NextRequest } from "next/server";

import { ok, withRoute } from "@/lib/api/route";
import { FEED_POST_WRITE, feedDb, refusal, writer } from "@/lib/feed/http";
import { hideFeedPost } from "@/lib/feed/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { id: string };

export const POST = withRoute<Params>("feed.hide", async (req: NextRequest, { params }) => {
  const { id } = await params;
  const user = await writer(req, FEED_POST_WRITE);
  if (!user.ok) return user.response;
  try {
    await hideFeedPost(feedDb(), user.value.id, id);
    return ok({ ok: true });
  } catch (error) {
    return refusal(error);
  }
});
