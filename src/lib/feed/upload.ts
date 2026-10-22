/**
 * A post's photo or audio, from the author's file to the `feed-media` bucket
 * (2026-10-17). Server-only.
 *
 * PHOTOS go through the same pipeline as a course cover
 * (`src/lib/lms/mediaPipeline.ts`): upright, EXIF (and its GPS) dropped, WebP at
 * 1600 and 640, an animated GIF kept as it is. AUDIO is stored as handed over —
 * there is no transcoder on the server — after its type, its size (≤ 20 MB)
 * and its first bytes are checked.
 *
 * The bucket is the feed's own, not `course-media`: that one is capped at 5 MB
 * and images, and its sweeper counts anything no course points at as an orphan.
 * Folders are `<authorId>/<uuid>/…`, the shape `checkFeedMedia` insists a post
 * names, so a post can only carry its own author's uploads.
 *
 * An upload no post ever names stays in the bucket. That is the same trade the
 * course media made before its sweeper; it is noted, not solved, here.
 */

import { randomUUID } from "node:crypto";

import { MAX_INPUT_BYTES, isPrepareFailure, prepareMedia } from "@/lib/lms/mediaPipeline";

import {
  FEED_AUDIO_MAX_BYTES,
  FEED_AUDIO_TYPES,
  FEED_CLIP_MAX_BYTES,
  FEED_CLIP_TYPES,
  FEED_MEDIA_BUCKET,
  feedAudioExtension,
  feedMediaUrl,
  looksLikeAudio,
} from "./media";
import { FeedError, type Db, type FeedAuthor } from "./server";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

export type UploadedPhoto = { kind: "photo"; path: string; src: string; w: number; h: number };
export type UploadedAudio = { kind: "audio"; path: string; src: string; mime: string; bytes: number };
export type UploadedMedia = UploadedPhoto | UploadedAudio;

/** Which kind a file's declared type is, or null for one the feed does not take. */
export function feedUploadKind(type: string): "photo" | "audio" | null {
  if (IMAGE_TYPES.has(type)) return "photo";
  if (FEED_AUDIO_TYPES[type]) return "audio";
  return null;
}

async function put(db: Db, path: string, bytes: Uint8Array, contentType: string): Promise<void> {
  const { error } = await db.storage.from(FEED_MEDIA_BUCKET).upload(path, bytes, {
    contentType,
    upsert: false,
    cacheControl: "31536000",
  });
  if (error) throw new Error(`feed_media_upload_failed:${error.message}`);
}

export async function storeFeedMedia(db: Db, author: FeedAuthor, file: File): Promise<UploadedMedia> {
  const kind = feedUploadKind(file.type);
  if (!kind) throw new FeedError("media_unsupported_type", 415);
  const folder = `${author.id}/${randomUUID()}`;

  if (kind === "audio") {
    const mime = FEED_AUDIO_TYPES[file.type] as string;
    if (file.size > FEED_AUDIO_MAX_BYTES) throw new FeedError("media_too_large", 413);
    if (file.size === 0) throw new FeedError("media_invalid");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!looksLikeAudio(bytes, mime)) throw new FeedError("media_not_audio", 415);
    const path = `${folder}/audio.${feedAudioExtension(mime)}`;
    await put(db, path, bytes, mime);
    return { kind: "audio", path, src: feedMediaUrl(path), mime, bytes: bytes.byteLength };
  }

  if (file.size > MAX_INPUT_BYTES) throw new FeedError("media_too_large", 413);
  const prepared = await prepareMedia(Buffer.from(await file.arrayBuffer()), file.type);
  if (isPrepareFailure(prepared)) {
    throw prepared.error === "media_not_an_image"
      ? new FeedError("media_not_an_image", 415)
      : new FeedError("media_too_large", 413);
  }
  const [primary] = prepared.renditions;
  if (!primary) throw new Error("feed_media_upload_failed:empty");

  const stored: string[] = [];
  try {
    for (const rendition of prepared.renditions) {
      const path = `${folder}/${rendition.name}`;
      await put(db, path, rendition.bytes, rendition.contentType);
      stored.push(path);
    }
  } catch (error) {
    if (stored.length) await db.storage.from(FEED_MEDIA_BUCKET).remove(stored);
    throw error;
  }
  const path = `${folder}/${primary.name}`;
  return { kind: "photo", path, src: feedMediaUrl(path), w: prepared.width, h: prepared.height };
}

export type SignedClip = { path: string; uploadUrl: string; src: string };

/**
 * A clip is too big for a function's request body, so it does not pass through
 * one: the author is handed a one-time address in the bucket and sends the file
 * there. What the server holds on to is the checks that need no bytes — the
 * type and the size claimed, which the bucket's own limits then enforce — and
 * the folder, which is the author's.
 */
export async function signFeedClip(db: Db, author: FeedAuthor, mime: unknown, bytes: unknown): Promise<SignedClip> {
  const ext = typeof mime === "string" ? FEED_CLIP_TYPES[mime] : undefined;
  if (!ext) throw new FeedError("media_unsupported_type", 415);
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) throw new FeedError("media_invalid");
  if (bytes > FEED_CLIP_MAX_BYTES) throw new FeedError("media_too_large", 413);
  const path = `${author.id}/${randomUUID()}/clip.${ext}`;
  const { data, error } = await db.storage.from(FEED_MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`feed_media_upload_failed:${error?.message ?? "no_url"}`);
  return { path, uploadUrl: data.signedUrl, src: feedMediaUrl(path) };
}
