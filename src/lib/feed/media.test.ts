import { describe, expect, it } from "vitest";

import { checkFeedMedia, feedMediaUrl, looksLikeAudio, readFeedMedia } from "./media";

const AUTHOR = "00000000-0000-4000-8000-0000000000a1";
const ASSET = "00000000-0000-4000-8000-0000000000f1";

describe("checkFeedMedia", () => {
  it("is empty when nothing is sent", () => {
    expect(checkFeedMedia(undefined, AUTHOR)).toEqual({ media: {} });
    expect(checkFeedMedia({ photos: [], video: null, audio: null }, AUTHOR)).toEqual({ media: {} });
  });

  it("keeps the stored shape only: no src, spoiler as a boolean, repeats dropped", () => {
    const path = `${AUTHOR}/${ASSET}/1600.webp`;
    const result = checkFeedMedia(
      {
        photos: [
          { path, w: 10, h: 20, spoiler: "yes", src: "https://evil" },
          { path, w: 10, h: 20 },
        ],
      },
      AUTHOR,
    );
    expect(result).toEqual({ media: { photos: [{ path, w: 10, h: 20, spoiler: false }] } });
  });

  it("refuses a path outside the author's folder or of an unknown file, and a zero size", () => {
    for (const path of [
      `other/${ASSET}/1600.webp`,
      `${AUTHOR}/${ASSET}/evil.html`,
      `${AUTHOR}/not-a-uuid/1600.webp`,
      `${AUTHOR}/${ASSET}/x/1600.webp`,
      `https://cdn/${AUTHOR}/${ASSET}/1600.webp`,
    ]) {
      expect(checkFeedMedia({ photos: [{ path, w: 1, h: 1 }] }, AUTHOR)).toEqual({ error: "media_invalid" });
    }
    expect(checkFeedMedia({ photos: [{ path: `${AUTHOR}/${ASSET}/640.webp`, w: 0, h: 1 }] }, AUTHOR)).toEqual({
      error: "media_invalid",
    });
  });

  it("accepts a pasted YouTube link or a bare id", () => {
    expect(checkFeedMedia({ video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3" }, AUTHOR)).toEqual({
      media: { video: { youtubeId: "dQw4w9WgXcQ" } },
    });
    expect(checkFeedMedia({ video: { youtubeId: "dQw4w9WgXcQ" } }, AUTHOR)).toMatchObject({ media: { video: {} } });
  });

  it("normalises the audio type and bounds its length", () => {
    const path = `${AUTHOR}/${ASSET}/audio.m4a`;
    expect(checkFeedMedia({ audio: { path, mime: "audio/x-m4a", durationSec: 600 } }, AUTHOR)).toEqual({
      media: { audio: { path, mime: "audio/mp4", durationSec: 600 } },
    });
    expect(checkFeedMedia({ audio: { path, mime: "audio/mp4", durationSec: 0 } }, AUTHOR)).toEqual({
      error: "media_invalid",
    });
    expect(checkFeedMedia({ audio: { path, mime: "video/mp4", durationSec: 5 } }, AUTHOR)).toEqual({
      error: "media_invalid",
    });
  });
});

describe("readFeedMedia", () => {
  it("adds addresses and forgives what an older row got wrong", () => {
    const media = readFeedMedia(
      { photos: [{ path: "a/b/1600.webp", w: 2, h: 1, spoiler: true }, { nope: 1 }], video: { youtubeId: 5 } },
      "https://x.supabase.co/",
    );
    expect(media.photos).toEqual([
      {
        path: "a/b/1600.webp",
        w: 2,
        h: 1,
        spoiler: true,
        src: "https://x.supabase.co/storage/v1/object/public/feed-media/a/b/1600.webp",
      },
    ]);
    expect(media.video).toBeNull();
    expect(readFeedMedia(null)).toEqual({ photos: [], video: null, audio: null });
    expect(feedMediaUrl("a b/c", "")).toBe("/storage/v1/object/public/feed-media/a%20b/c");
  });
});

describe("looksLikeAudio", () => {
  it("knows each container by its first bytes", () => {
    expect(looksLikeAudio(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0]), "audio/webm")).toBe(true);
    expect(looksLikeAudio(new TextEncoder().encode("OggS...."), "audio/ogg")).toBe(true);
    expect(looksLikeAudio(new TextEncoder().encode("\0\0\0 ftypM4A "), "audio/mp4")).toBe(true);
    expect(looksLikeAudio(new TextEncoder().encode("ID3\x03"), "audio/mpeg")).toBe(true);
    expect(looksLikeAudio(new TextEncoder().encode("<html><script>"), "audio/mpeg")).toBe(false);
    expect(looksLikeAudio(new TextEncoder().encode("<html><script>"), "audio/webm")).toBe(false);
  });
});
