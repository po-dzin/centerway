/**
 * POST /api/feed/media — a photo or an audio for a post, from a listed author.
 *
 * multipart/form-data with `file`. A photo (jpeg, png, webp, gif, avif; ≤ 20 MB
 * in) is prepared as a course cover is and answers
 * `{ kind: "photo", path, src, w, h }`; an audio (webm, ogg, m4a/mp4, mp3;
 * ≤ 20 MB) is stored as it is and answers `{ kind: "audio", path, src, mime,
 * bytes }`. The post then names the `path` in its `media`. `?as=platform`: an
 * admin uploading for a post written as CenterWay.
 */

import type { NextRequest } from "next/server";

import { fail, ok, withRoute } from "@/lib/api/route";
import { FEED_MEDIA_UPLOAD, feedDb, postingAuthor, refusal } from "@/lib/feed/http";
import { storeFeedMedia } from "@/lib/feed/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = withRoute("feed.media", async (req: NextRequest) => {
  const db = feedDb();
  const author = await postingAuthor(req, db, req.nextUrl.searchParams.get("as") === "platform", FEED_MEDIA_UPLOAD);
  if (!author.ok) return author.response;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "media_expected_form_data");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail(400, "media_missing_file");
  try {
    return ok(await storeFeedMedia(db, author.value, file), { status: 201 });
  } catch (error) {
    return refusal(error);
  }
});
