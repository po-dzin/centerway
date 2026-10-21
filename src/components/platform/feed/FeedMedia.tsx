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
 * A CLIP is the author's own file, up to 30 seconds, in the browser's player.
 *
 * VIDEO is the lesson renderer's own player (`BlockRenderer`, privacy-enhanced
 * youtube-nocookie embed), so a post plays exactly as a lesson does.
 *
 * AUDIO is the browser's own player inside the DS plate: a recorded voice
 * note needs play, scrub and volume, which `<audio controls>` already gives
 * with keyboard and screen-reader support.
 */

import { useRef, useState, type CSSProperties } from "react";

import { Icon } from "@/components/Icon";
import { BlockRenderer } from "@/components/lms/LessonBlocks";
import { PhotoViewer } from "@/components/platform/PhotoViewer";
import type { FeedClip, FeedMedia as Media, FeedPhoto } from "@/lib/feed/media";

import { feedCopy } from "./copy";
import { FeedAudio } from "./FeedAudio";
import { claimFeedPlayback, useFeedMediaSession, type FeedMediaAbout } from "./mediaSession";
import styles from "./Feed.module.css";

const NOOP = () => {};

function photoSources(photo: FeedPhoto): { src: string; srcSet?: string } {
  if (!photo.src.endsWith("/1600.webp")) return { src: photo.src };
  const small = photo.src.replace(/\/1600\.webp$/, "/640.webp");
  return { src: photo.src, srcSet: `${small} 640w, ${photo.src} 1600w` };
}

function Photo({
  photo,
  alt,
  single,
  revealed,
  onReveal,
  onOpen,
}: {
  photo: FeedPhoto;
  alt: string;
  single: boolean;
  revealed: boolean;
  onReveal: () => void;
  onOpen: () => void;
}) {
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
    /* A press opens the viewer: the photo full screen, with its neighbours. */
    return (
      <button
        className={styles.photo}
        type="button"
        style={{ "--photo-ratio": `${photo.w} / ${photo.h}` } as CSSProperties}
        aria-label={feedCopy.viewerLabel}
        onClick={onOpen}
      >
        {image}
      </button>
    );
  }
  return (
    <button
      className={`${styles.photo} ${styles.spoiler}`}
      type="button"
      style={{ "--photo-ratio": `${photo.w} / ${photo.h}` } as CSSProperties}
      aria-label={feedCopy.spoilerLabel}
      onClick={onReveal}
    >
      {image}
      <span className={styles.spoilerVeil} aria-hidden="true">
        <Icon name="spoiler" size={24} />
        <span>{feedCopy.spoiler}</span>
      </span>
    </button>
  );
}

/** The author's own short clip, played by the browser's player at its own proportions; it tells the phone what is playing, like the audio. */
function Clip({ clip, about }: { clip: FeedClip; about: FeedMediaAbout }) {
  const player = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  useFeedMediaSession(player, about, playing);
  return (
    <video
      ref={player}
      data-no-open=""
      className={styles.postClip}
      style={{ "--clip-ratio": `${clip.w} / ${clip.h}`, "--clip-k": clip.w / clip.h } as CSSProperties}
      controls
      playsInline
      preload="metadata"
      aria-label={feedCopy.postVideo}
      onPlay={(event) => {
        claimFeedPlayback(event.currentTarget);
        setPlaying(true);
      }}
      onPause={() => setPlaying(false)}
      onEnded={() => setPlaying(false)}
    >
      <source src={clip.src} type={clip.mime} />
    </video>
  );
}

export function FeedMedia({ media, postId, about }: { media: Media; postId: string; about: FeedMediaAbout }) {
  const { photos, video, clip, audio } = media;
  // A spoiler stays out of the viewer until its reader has lifted the veil.
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
  const [opened, setOpened] = useState<number | null>(null);
  if (!photos.length && !video && !clip && !audio) return null;
  const single = photos.length === 1;
  const viewable = photos.filter((photo) => !photo.spoiler || revealed.has(photo.path));
  return (
    <>
      {photos.length ? (
        <div
          className={single ? styles.photoOne : `${styles.photoRow} cw-scroll-none`}
          role={single ? undefined : "group"}
          aria-label={single ? undefined : feedCopy.photos}
          data-no-open=""
        >
          {photos.map((photo, index) => (
            <Photo
              key={photo.path}
              photo={photo}
              single={single}
              alt={single ? feedCopy.photo : feedCopy.photoOf(index + 1, photos.length)}
              revealed={revealed.has(photo.path)}
              onReveal={() => setRevealed((current) => new Set(current).add(photo.path))}
              onOpen={() => setOpened(viewable.findIndex((entry) => entry.path === photo.path))}
            />
          ))}
        </div>
      ) : null}
      {opened !== null && opened >= 0 ? (
        <PhotoViewer
          photos={viewable.map((photo, index) => ({
            src: photo.src,
            w: photo.w,
            h: photo.h,
            alt: viewable.length === 1 ? feedCopy.photo : feedCopy.photoOf(index + 1, viewable.length),
          }))}
          start={opened}
          label={feedCopy.viewerLabel}
          onClose={() => setOpened(null)}
        />
      ) : null}

      {video ? (
        <div className={styles.postVideo} data-no-open="">
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

      {clip ? <Clip clip={clip} about={about} /> : null}

      {audio ? <FeedAudio audio={audio} about={about} /> : null}
    </>
  );
}
