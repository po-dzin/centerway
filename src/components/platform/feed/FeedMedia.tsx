"use client";

/**
 * What a post carries besides words (G 2026-10-17): photos, one YouTube video,
 * one audio.
 *
 * PHOTOS. One photo spans the card; two or more stand in a row that scrolls
 * sideways, Threads-like, each at its own proportions — nothing is hidden
 * behind a «+3» that would need a viewer of its own. A photo never stands
 * taller than min(60svh, 28rem) in the feed and 14rem on the home rail, so an
 * open card stays about one phone screen. A spoiler is blurred under a veil
 * until the reader taps it; the tap only reveals, it opens nothing.
 *
 * VIDEO is the lesson renderer's own player (`BlockRenderer`, privacy-enhanced
 * youtube-nocookie embed), so a post plays exactly as a lesson does.
 *
 * AUDIO is the browser's own player inside the DS plate: a recorded voice
 * note needs play, scrub and volume, which `<audio controls>` already gives
 * with keyboard and screen-reader support.
 */

import { useState, type CSSProperties } from "react";

import { Icon } from "@/components/Icon";
import { BlockRenderer } from "@/components/lms/LessonBlocks";
import type { FeedMedia as Media, FeedPhoto } from "@/lib/feed/media";

import { feedCopy } from "./copy";
import styles from "./Feed.module.css";

const NOOP = () => {};

function photoSources(photo: FeedPhoto): { src: string; srcSet?: string } {
  if (!photo.src.endsWith("/1600.webp")) return { src: photo.src };
  const small = photo.src.replace(/\/1600\.webp$/, "/640.webp");
  return { src: photo.src, srcSet: `${small} 640w, ${photo.src} 1600w` };
}

function Photo({ photo, alt, single }: { photo: FeedPhoto; alt: string; single: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const { src, srcSet } = photoSources(photo);
  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- the feed bucket's own 640/1600 renditions
    <img
      className={styles.photoImg}
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? (single ? "(max-width: 44rem) 100vw, 42rem" : "(max-width: 44rem) 80vw, 30rem") : undefined}
      width={photo.w}
      height={photo.h}
      alt={photo.spoiler && !revealed ? "" : alt}
      loading="lazy"
      decoding="async"
    />
  );
  if (!photo.spoiler || revealed) {
    return (
      <div className={styles.photo} style={{ "--photo-ratio": `${photo.w} / ${photo.h}` } as CSSProperties}>
        {image}
      </div>
    );
  }
  return (
    <button
      className={`${styles.photo} ${styles.spoiler}`}
      type="button"
      style={{ "--photo-ratio": `${photo.w} / ${photo.h}` } as CSSProperties}
      aria-label={feedCopy.spoilerLabel}
      onClick={() => setRevealed(true)}
    >
      {image}
      <span className={styles.spoilerVeil} aria-hidden="true">
        <Icon name="spoiler" size={24} />
        <span>{feedCopy.spoiler}</span>
      </span>
    </button>
  );
}

export function FeedMedia({ media, postId }: { media: Media; postId: string }) {
  const { photos, video, audio } = media;
  if (!photos.length && !video && !audio) return null;
  const single = photos.length === 1;
  return (
    <>
      {photos.length ? (
        <div
          className={single ? styles.photoOne : `${styles.photoRow} cw-scroll-rail`}
          role={single ? undefined : "group"}
          aria-label={single ? undefined : feedCopy.photos}
        >
          {photos.map((photo, index) => (
            <Photo
              key={photo.path}
              photo={photo}
              single={single}
              alt={single ? feedCopy.photo : feedCopy.photoOf(index + 1, photos.length)}
            />
          ))}
        </div>
      ) : null}

      {video ? (
        <div className={styles.postVideo}>
          <BlockRenderer
            block={{
              id: `${postId}-video`,
              type: "video",
              provider: "youtube",
              videoId: video.youtubeId,
              title: feedCopy.postVideo,
            }}
            checklist={{}}
            onToggleChecklistItem={NOOP}
          />
        </div>
      ) : null}

      {audio ? (
        <figure className={styles.audio}>
          <figcaption className={styles.audioLabel}>
            {audio.durationSec > 0
              ? `${feedCopy.audio} · ${Math.floor(audio.durationSec / 60)}:${String(Math.round(audio.durationSec % 60)).padStart(2, "0")}`
              : feedCopy.audio}
          </figcaption>
          <audio className={styles.audioPlayer} controls preload="metadata">
            <source src={audio.src} type={audio.mime} />
          </audio>
        </figure>
      ) : null}
    </>
  );
}
