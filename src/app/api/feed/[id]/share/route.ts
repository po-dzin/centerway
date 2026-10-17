/**
 * /api/feed/:id/share — «Поділитися» counted (G 17.10).
 *
 * POST { channel } records that the signed-in reader shared the post: one per
 * account, so a second share answers `{ first: false }` and moves nothing. A
 * guest's share is not sent at all (see FeedActions).
 */

import type { NextRequest } from "next/server";

import { ok, withRoute } from "@/lib/api/route";
import { FEED_READER_WRITE, feedDb, jsonBody, refusal, writer } from "@/lib/feed/http";
import { recordShare } from "@/lib/feed/server";

export const runtime = "nodejs";

type Params = { id: string };

export const POST = withRoute<Params>("feed.share", async (req: NextRequest, { params }) => {
  const { id } = await params;
  const user = await writer(req, FEED_READER_WRITE);
  if (!user.ok) return user.response;
  const body = await jsonBody(req);
  try {
    return ok({ first: await recordShare(feedDb(), id, user.value.id, body.channel) });
  } catch (error) {
    return refusal(error);
  }
});
