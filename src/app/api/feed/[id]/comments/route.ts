/**
 * /api/feed/:id/comments
 *
 * GET  the thread, oldest first; open to everyone.
 * POST `{ body, parentId? }` from a signed-in reader. A comment the check stops
 *      waits for the team and is shown only to its writer.
 */

import { after, type NextRequest } from "next/server";

import { ok, withRoute } from "@/lib/api/route";
import { FEED_READER_WRITE, feedDb, jsonBody, refusal, viewerOf, writer } from "@/lib/feed/http";
import { addComment, listComments } from "@/lib/feed/server";
import { sendHeldCommentCard } from "@/lib/feed/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { id: string };

export const GET = withRoute<Params>("feed.comments", async (req, { params }) => {
  const { id } = await params;
  const viewer = await viewerOf(req);
  try {
    return ok({ comments: await listComments(feedDb(), id, viewer?.id ?? null) });
  } catch (error) {
    return refusal(error);
  }
});

export const POST = withRoute<Params>("feed.comment", async (req: NextRequest, { params }) => {
  const { id } = await params;
  const user = await writer(req, FEED_READER_WRITE);
  if (!user.ok) return user.response;
  try {
    const created = await addComment(feedDb(), id, user.value.id, await jsonBody(req));
    if (created.held) {
      after(() => sendHeldCommentCard(created.comment.id, { body: created.comment.body, verdict: created.verdict }));
    }
    return ok({ comment: created.comment, held: created.held }, { status: 201 });
  } catch (error) {
    return refusal(error);
  }
});
