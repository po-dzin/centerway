/**
 * /api/feed/:id — one post.
 *
 * GET    published for everyone; the author also sees their own held or returned post.
 * PATCH  the author sends a returned post again, edited: the same fields as POST /api/feed.
 *        An admin changes a post of the platform's or their own with `asPlatform` (true:
 *        the platform's name, false: their own) and `pinned`; `pinOnly: true` with
 *        `pinned` moves the pin alone, on any published post.
 * DELETE the author removes their own post; an admin removes any.
 */

import { after, type NextRequest } from "next/server";

import { fail, ok, withRoute } from "@/lib/api/route";
import { authorWriter, feedDb, jsonBody, refusal, viewerOf, writer, FEED_POST_WRITE } from "@/lib/feed/http";
import {
  deleteFeedPost,
  editPostAsAdmin,
  feedAuthorForUser,
  getFeedPost,
  resubmitFeedPost,
  setPostPin,
} from "@/lib/feed/server";
import { sendHeldPostCard } from "@/lib/feed/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { id: string };

export const GET = withRoute<Params>("feed.get", async (req, { params }) => {
  const { id } = await params;
  const viewer = await viewerOf(req);
  const post = await getFeedPost(feedDb(), id, viewer?.id ?? null);
  return post ? ok({ post }) : fail(404, "not_found");
});

export const PATCH = withRoute<Params>("feed.resubmit", async (req: NextRequest, { params }) => {
  const { id } = await params;
  const db = feedDb();
  const body = await jsonBody(req);
  /* An admin's changes: the pin alone, or the words with a choice of voice
     (the platform's name or their own). Anyone else falls through to the
     author's own flow below. */
  if (body.pinOnly === true || typeof body.asPlatform === "boolean") {
    const user = await writer(req, FEED_POST_WRITE);
    if (!user.ok) return user.response;
    try {
      if (body.pinOnly === true) return ok({ post: await setPostPin(db, user.value.id, id, body.pinned === true) });
      const edited = await editPostAsAdmin(db, user.value.id, id, body, body.asPlatform === true);
      return ok({ post: edited.post, findings: [] });
    } catch (error) {
      return refusal(error);
    }
  }
  const author = await authorWriter(req, db);
  if (!author.ok) return author.response;
  try {
    const created = await resubmitFeedPost(db, author.value, id, body);
    if (created.post.status === "held") after(() => sendHeldPostCard(db, created.post.id));
    return ok({ post: created.post, findings: created.verdict.findings });
  } catch (error) {
    return refusal(error);
  }
});

export const DELETE = withRoute<Params>("feed.delete", async (req: NextRequest, { params }) => {
  const { id } = await params;
  const db = feedDb();
  const user = await writer(req, FEED_POST_WRITE);
  if (!user.ok) return user.response;
  /* Their own post as a listed author, and — for an admin — the platform's. */
  await deleteFeedPost(db, await feedAuthorForUser(db, user.value.id), id, { userId: user.value.id });
  return ok({ ok: true });
});
