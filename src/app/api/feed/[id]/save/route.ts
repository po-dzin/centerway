/**
 * /api/feed/:id/save — «Зберегти»: the post in the reader's «Мій журнал».
 *
 * POST   saves it (a bookmark the journal lists as «Стрічка · <автор>»).
 * DELETE takes it out. Both answer `{ saved }`; repeating either is success.
 */

import type { NextRequest } from "next/server";

import { ok, withRoute } from "@/lib/api/route";
import { FEED_READER_WRITE, feedDb, refusal, writer } from "@/lib/feed/http";
import { saveFeedPost, unsaveFeedPost } from "@/lib/feed/server";

export const runtime = "nodejs";

type Params = { id: string };

export const POST = withRoute<Params>("feed.save", async (req: NextRequest, { params }) => {
  const { id } = await params;
  const user = await writer(req, FEED_READER_WRITE);
  if (!user.ok) return user.response;
  try {
    await saveFeedPost(feedDb(), user.value.id, id);
    return ok({ saved: true });
  } catch (error) {
    return refusal(error);
  }
});

export const DELETE = withRoute<Params>("feed.unsave", async (req: NextRequest, { params }) => {
  const { id } = await params;
  const user = await writer(req, FEED_READER_WRITE);
  if (!user.ok) return user.response;
  await unsaveFeedPost(feedDb(), user.value.id, id);
  return ok({ saved: false });
});
