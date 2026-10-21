/**
 * What a post may carry besides words (2026-10-17). Client-safe and pure.
 *
 * G, 17.10: up to ten photos, each optionally a spoiler (blurred until
 * tapped); one YouTube video by link; one audio — recorded in the composer or
 * uploaded — of at most twenty megabytes and ten minutes.
 *
 * STORED: `{ photos: [{ path, w, h, spoiler }], video: { youtubeId }, audio:
 * { path, durationSec, mime } }` in `feed_posts.media`. Only the path inside
 * the `feed-media` bucket is stored; the public address is built when the post
 * is read (`feedMediaUrl`), so the bucket's host is not frozen into every row.
 *
 * A PATH MUST BE THE AUTHOR'S OWN UPLOAD: the upload route writes
 * `<authorId>/<uuid>/<file>`, and a post may only name files under its own
 * author's folder in exactly that shape. Anything else — another author's
 * photo, a path with `..`, a URL from elsewhere — is refused as `media_invalid`.
 */

import { youtubeIdFrom } from "@/lms-core";

export const FEED_MEDIA_BUCKET = "feed-media";
export const FEED_PHOTOS_MAX = 10;
export const FEED_AUDIO_MAX_BYTES = 20 * 1024 * 1024;
export const FEED_AUDIO_MAX_SECONDS = 10 * 60;
/**
 * A short clip of the author's own (G 2026-10-18): up to 30 seconds, Full HD,
 * 60 MB. No transcoder stands behind the feed, so the file is played as it was
 * recorded — which is why the ceiling is a short, light clip and the types are
 * the ones every browser plays (MP4/H.264, WebM, and an iPhone's MOV).
 */
export const FEED_CLIP_MAX_SECONDS = 30;
export const FEED_CLIP_MAX_BYTES = 60 * 1024 * 1024;
/** Full HD in either orientation: the long side up to 1920, the short up to 1080. */
export const FEED_CLIP_MAX_LONG = 1920;
export const FEED_CLIP_MAX_SHORT = 1080;
export const FEED_CLIP_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

/** Authors a post may name «з …». */
export const FEED_TAGS_MAX = 3;

/** What the browser may hand the audio upload, and the type it is stored under. */
export const FEED_AUDIO_TYPES: Record<string, string> = {
  "audio/webm": "audio/webm",
  "audio/ogg": "audio/ogg",
  "audio/mp4": "audio/mp4",
  "audio/x-m4a": "audio/mp4",
  "audio/m4a": "audio/mp4",
  "audio/mpeg": "audio/mpeg",
  "audio/mp3": "audio/mpeg",
};

const AUDIO_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
};

export function feedAudioExtension(mime: string): string | null {
  return AUDIO_EXT[mime] ?? null;
}

export type FeedPhotoStored = { path: string; w: number; h: number; spoiler: boolean };
/**
 * `peaks`: the recording's loudness in `FEED_AUDIO_PEAKS` steps, 0–100, measured
 * in the composer from the file itself — the waveform the player draws
 * (G 2026-10-21). Absent on audio posted before it; the player then draws a
 * quiet line, never an invented shape.
 */
export type FeedAudioStored = { path: string; durationSec: number; mime: string; peaks?: number[] };
export type FeedClipStored = { path: string; durationSec: number; w: number; h: number; mime: string };
export type FeedMediaStored = {
  photos?: FeedPhotoStored[];
  video?: { youtubeId: string } | null;
  /** The author's own short clip, instead of a YouTube link. */
  clip?: FeedClipStored | null;
  audio?: FeedAudioStored | null;
};

/** What a reader receives: the same, with addresses. */
export type FeedPhoto = FeedPhotoStored & { src: string };
export type FeedAudio = FeedAudioStored & { src: string };
export type FeedClip = FeedClipStored & { src: string };
export type FeedMedia = {
  photos: FeedPhoto[];
  video: { youtubeId: string } | null;
  clip?: FeedClip | null;
  audio: FeedAudio | null;
};

export const EMPTY_FEED_MEDIA: FeedMedia = { photos: [], video: null, audio: null };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PHOTO_FILE = /^(1600|640)\.webp$|^original\.gif$/;
/** How many loudness steps an audio's waveform has. */
export const FEED_AUDIO_PEAKS = 48;

/** `peaks` as stored: exactly `FEED_AUDIO_PEAKS` whole numbers 0–100, or nothing. */
export function normalizeFeedPeaks(value: unknown): number[] | undefined {
  if (!Array.isArray(value) || value.length !== FEED_AUDIO_PEAKS) return undefined;
  if (!value.every((peak) => typeof peak === "number" && Number.isFinite(peak))) return undefined;
  return value.map((peak: number) => Math.min(100, Math.max(0, Math.round(peak))));
}

const AUDIO_FILE = /^audio\.(webm|ogg|m4a|mp3)$/;
const CLIP_FILE = /^clip\.(mp4|webm|mov)$/;

/** `<authorId>/<uuid>/<file>` under the given author, with a file the route writes. */
function ownPath(value: unknown, authorId: string, file: RegExp): value is string {
  if (typeof value !== "string" || value.length > 200) return false;
  const parts = value.split("/");
  if (parts.length !== 3) return false;
  const [owner, asset, name] = parts as [string, string, string];
  return owner === authorId && new RegExp(`^${UUID}$`, "i").test(asset) && file.test(name);
}

const dimension = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 20000 ? value : null;

/**
 * The media a composer sent, checked and reduced to what is stored. `null` or
 * absent means none. Throws nothing: an invalid shape answers `{ error }`.
 */
export function checkFeedMedia(input: unknown, authorId: string): { media: FeedMediaStored } | { error: string } {
  if (input === undefined || input === null) return { media: {} };
  if (typeof input !== "object" || Array.isArray(input)) return { error: "media_invalid" };
  const raw = input as Record<string, unknown>;
  const media: FeedMediaStored = {};

  if (raw.photos !== undefined && raw.photos !== null) {
    if (!Array.isArray(raw.photos)) return { error: "media_invalid" };
    if (raw.photos.length > FEED_PHOTOS_MAX) return { error: "media_too_many_photos" };
    const photos: FeedPhotoStored[] = [];
    const seen = new Set<string>();
    for (const entry of raw.photos as unknown[]) {
      if (!entry || typeof entry !== "object") return { error: "media_invalid" };
      const photo = entry as Record<string, unknown>;
      const w = dimension(photo.w);
      const h = dimension(photo.h);
      if (!ownPath(photo.path, authorId, PHOTO_FILE) || !w || !h) return { error: "media_invalid" };
      if (seen.has(photo.path)) continue;
      seen.add(photo.path);
      photos.push({ path: photo.path, w, h, spoiler: photo.spoiler === true });
    }
    if (photos.length) media.photos = photos;
  }

  if (raw.video !== undefined && raw.video !== null) {
    const video = raw.video as Record<string, unknown>;
    const source = typeof video === "string" ? video : typeof video === "object" ? video.youtubeId : null;
    const youtubeId = typeof source === "string" ? youtubeIdFrom(source) : null;
    if (!youtubeId) return { error: "media_video_invalid" };
    media.video = { youtubeId };
  }

  if (raw.clip !== undefined && raw.clip !== null) {
    if (typeof raw.clip !== "object" || Array.isArray(raw.clip) || media.video) return { error: "media_invalid" };
    const clip = raw.clip as Record<string, unknown>;
    const ext = typeof clip.mime === "string" ? FEED_CLIP_TYPES[clip.mime] : undefined;
    const w = dimension(clip.w);
    const h = dimension(clip.h);
    const duration =
      typeof clip.durationSec === "number" && Number.isFinite(clip.durationSec) ? Math.ceil(clip.durationSec) : null;
    if (!ext || !ownPath(clip.path, authorId, CLIP_FILE) || !(clip.path as string).endsWith(`.${ext}`) || !w || !h) {
      return { error: "media_invalid" };
    }
    if (duration === null || duration < 1) return { error: "media_invalid" };
    if (duration > FEED_CLIP_MAX_SECONDS) return { error: "media_clip_too_long" };
    if (Math.max(w, h) > FEED_CLIP_MAX_LONG || Math.min(w, h) > FEED_CLIP_MAX_SHORT) {
      return { error: "media_clip_too_large" };
    }
    media.clip = { path: clip.path as string, durationSec: duration, w, h, mime: clip.mime as string };
  }

  if (raw.audio !== undefined && raw.audio !== null) {
    if (typeof raw.audio !== "object") return { error: "media_invalid" };
    const audio = raw.audio as Record<string, unknown>;
    const mime = typeof audio.mime === "string" ? FEED_AUDIO_TYPES[audio.mime] : undefined;
    const duration =
      typeof audio.durationSec === "number" && Number.isFinite(audio.durationSec)
        ? Math.round(audio.durationSec)
        : null;
    if (!mime || !ownPath(audio.path, authorId, AUDIO_FILE)) return { error: "media_invalid" };
    if (!(audio.path as string).endsWith(`.${feedAudioExtension(mime)}`)) return { error: "media_invalid" };
    if (duration === null || duration < 1) return { error: "media_invalid" };
    if (duration > FEED_AUDIO_MAX_SECONDS) return { error: "media_audio_too_long" };
    const peaks = normalizeFeedPeaks(audio.peaks);
    media.audio = { path: audio.path as string, durationSec: duration, mime, ...(peaks ? { peaks } : {}) };
  }

  return { media };
}

/** The public address of an object in the feed's bucket. */
export function feedMediaUrl(path: string, base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${base.replace(/\/+$/, "")}/storage/v1/object/public/${FEED_MEDIA_BUCKET}/${encoded}`;
}

/**
 * A stored `media` value as a reader receives it. Lenient on purpose: a row
 * written by an older shape, or edited by hand, loses the part it got wrong
 * rather than the whole post.
 */
export function readFeedMedia(stored: unknown, base?: string): FeedMedia {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return EMPTY_FEED_MEDIA;
  const raw = stored as Record<string, unknown>;
  const photos = Array.isArray(raw.photos)
    ? (raw.photos as unknown[]).flatMap((entry) => {
        const photo = entry as Partial<FeedPhotoStored> | null;
        if (!photo || typeof photo.path !== "string") return [];
        const w = dimension(photo.w) ?? 1;
        const h = dimension(photo.h) ?? 1;
        return [{ path: photo.path, w, h, spoiler: photo.spoiler === true, src: feedMediaUrl(photo.path, base) }];
      })
    : [];
  const video = raw.video as { youtubeId?: unknown } | null | undefined;
  const clip = raw.clip as Partial<FeedClipStored> | null | undefined;
  const audio = raw.audio as Partial<FeedAudioStored> | null | undefined;
  return {
    photos: photos.slice(0, FEED_PHOTOS_MAX),
    video: video && typeof video.youtubeId === "string" ? { youtubeId: video.youtubeId } : null,
    clip:
      clip && typeof clip.path === "string" && typeof clip.mime === "string"
        ? {
            path: clip.path,
            mime: clip.mime,
            durationSec: typeof clip.durationSec === "number" ? clip.durationSec : 0,
            w: dimension(clip.w) ?? 16,
            h: dimension(clip.h) ?? 9,
            src: feedMediaUrl(clip.path, base),
          }
        : null,
    audio:
      audio && typeof audio.path === "string" && typeof audio.mime === "string"
        ? {
            path: audio.path,
            mime: audio.mime,
            durationSec: typeof audio.durationSec === "number" ? audio.durationSec : 0,
            ...(normalizeFeedPeaks(audio.peaks) ? { peaks: normalizeFeedPeaks(audio.peaks) } : {}),
            src: feedMediaUrl(audio.path, base),
          }
        : null,
  };
}

/**
 * Whether the first bytes are the audio container the type claims. Cheap, and
 * enough to keep a page or a script from being stored as «audio» in a public
 * bucket under our name.
 */
export function looksLikeAudio(bytes: Uint8Array, mime: string): boolean {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  switch (mime) {
    case "audio/webm":
      return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
    case "audio/ogg":
      return ascii(0, 4) === "OggS";
    case "audio/mp4":
      return ascii(4, 8) === "ftyp";
    case "audio/mpeg":
      return ascii(0, 3) === "ID3" || (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0);
    default:
      return false;
  }
}
