"use client";

/**
 * A post's photos, full screen (G 2026-10-18): the picture at its own
 * proportions on a dark ground, arrows on both sides, «2 / 5» under it.
 *
 * A native `<dialog>` opened modal, so focus stays inside, Escape closes it and
 * the page behind does not scroll. Left and right arrows on the keyboard, and
 * a swipe on a phone, turn the picture. Only photos the reader may see are
 * handed in: a spoiler still under its veil is not here.
 */

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/Icon";
import type { FeedPhoto } from "@/lib/feed/media";

import { feedCopy } from "./copy";
import styles from "./Feed.module.css";

const SWIPE = 48;

export function FeedPhotoViewer({
  photos,
  start,
  onClose,
}: {
  photos: FeedPhoto[];
  start: number;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(start);
  const touch = useRef<number | null>(null);
  const last = photos.length - 1;
  const photo = photos[index];

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  const go = (step: number) => setIndex((current) => Math.min(last, Math.max(0, current + step)));

  if (!photo) return null;
  return (
    <dialog
      ref={dialog}
      className={styles.viewer}
      aria-label={feedCopy.viewerLabel}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") go(-1);
        if (event.key === "ArrowRight") go(1);
      }}
      onTouchStart={(event) => {
        touch.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const from = touch.current;
        const to = event.changedTouches[0]?.clientX;
        touch.current = null;
        if (from === null || to === undefined) return;
        if (to - from > SWIPE) go(-1);
        if (from - to > SWIPE) go(1);
      }}
    >
      <button
        className={styles.viewerClose}
        type="button"
        aria-label={feedCopy.viewerClose}
        onClick={() => dialog.current?.close()}
      >
        <Icon name="close" size={20} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- the feed bucket's own rendition */}
      <img
        className={styles.viewerImg}
        src={photo.src}
        width={photo.w || undefined}
        height={photo.h || undefined}
        alt={feedCopy.photo}
      />
      {photos.length > 1 ? (
        <>
          <button
            className={`${styles.viewerStep} ${styles.viewerPrev}`}
            type="button"
            aria-label={feedCopy.viewerPrev}
            disabled={index === 0}
            onClick={() => go(-1)}
          >
            <Icon name="arrow-left" size={20} />
          </button>
          <button
            className={`${styles.viewerStep} ${styles.viewerNext}`}
            type="button"
            aria-label={feedCopy.viewerNext}
            disabled={index === last}
            onClick={() => go(1)}
          >
            <Icon name="arrow-right" size={20} />
          </button>
          <p className={styles.viewerCount} aria-live="polite">
            {index + 1} / {photos.length}
          </p>
        </>
      ) : null}
    </dialog>
  );
}
