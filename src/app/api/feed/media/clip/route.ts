/**
 * POST /api/feed/media/clip — an address to send a short clip to.
 *
 * `{ mime, bytes }` → `{ path, uploadUrl, src }`. The file itself goes straight
 * to `uploadUrl` (a one-time address in the feed's bucket), never through this
 * server: a clip is larger than a function accepts. The post then names `path`
 * in `media.clip` with the duration and size the browser read.
 */

import type { NextRequest } from "next/server";

import { ok, withRoute } from "@/lib/api/route";
import { FEED_MEDIA_UPLOAD, feedDb, jsonBody, postingAuthor, refusal } from "@/lib/feed/http";
import { signFeedClip } from "@/lib/feed/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withRoute("feed.media.clip", async (req: NextRequest) => {
  const db = feedDb();
  const author = await postingAuthor(req, db, req.nextUrl.searchParams.get("as") === "platform", FEED_MEDIA_UPLOAD);
  if (!author.ok) return author.response;
  const body = await jsonBody(req);
  try {
    return ok(await signFeedClip(db, author.value, body.mime, body.bytes), { status: 201 });
  } catch (error) {
    return refusal(error);
  }
});
