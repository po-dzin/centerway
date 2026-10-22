"use client";

/**
 * ONE FULL-SCREEN PHOTO VIEWER for the whole platform (G 2026-10-18, made
 * shared 2026-10-21). It began as the feed's; G asked for the same viewer in
 * the builder, the library, products, course screenshots and generated images,
 * so it lives here and takes plain pictures — whoever opens it says what they
 * are and what the dialog is called.
 *
 * The picture at its own proportions on a dark ground, with arrows and the
 * counter on bottom glass islands.
 *
 * A native `<dialog>` opened modal, so focus stays inside, Escape closes it and
 * the page behind does not scroll. Left and right arrows on the keyboard, and
 * a swipe on a phone, turn the picture. Only photos the reader may see are
 * handed in: a spoiler still under its veil is not here.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Icon } from "@/components/Icon";

import styles from "./PhotoViewer.module.css";

/** One picture to show: the full rendition, its words, and its size when known. */
export type ViewerPhoto = { src: string; alt: string; w?: number; h?: number };

const copy = {
  label: "Фото",
  close: "Закрити",
  prev: "Попереднє фото",
  next: "Наступне фото",
};

const SWIPE = 48;

export function PhotoViewer({
  photos,
  start,
  onClose,
  label = copy.label,
}: {
  photos: ViewerPhoto[];
  start: number;
  onClose: () => void;
  /** What the dialog is called for a screen reader, e.g. «Фото з допису». */
  label?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(start);
  const touch = useRef<number | null>(null);
  const last = photos.length - 1;
  const photo = photos[index];

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) {
      element.showModal();
      element.focus({ preventScroll: true });
    }
  }, []);

  useLayoutEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  const go = (step: number) => setIndex((current) => Math.min(last, Math.max(0, current + step)));

  if (!photo) return null;
  return (
    <dialog
      ref={dialog}
      className={styles.viewer}
      aria-label={label}
      tabIndex={-1}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") go(-1);
        if (event.key === "ArrowRight") go(1);
        if (event.key === "Home") setIndex(0);
        if (event.key === "End") setIndex(last);
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
      <button className={styles.close} type="button" aria-label={copy.close} onClick={() => dialog.current?.close()}>
        <Icon name="close" size={20} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- each caller's own stored rendition */}
      <img
        className={styles.img}
        src={photo.src}
        width={photo.w || undefined}
        height={photo.h || undefined}
        alt={photo.alt}
      />
      <div className={styles.tools}>
        {photos.length > 1 ? (
          <>
            <button
              className={`${styles.step} ${styles.prev}`}
              type="button"
              aria-label={copy.prev}
              disabled={index === 0}
              onClick={() => go(-1)}
            >
              <Icon name="arrow-left" size={20} />
            </button>
            <button
              className={`${styles.step} ${styles.next}`}
              type="button"
              aria-label={copy.next}
              disabled={index === last}
              onClick={() => go(1)}
            >
              <Icon name="arrow-right" size={20} />
            </button>
          </>
        ) : null}
        <p className={styles.count} aria-live="polite">
          {index + 1} / {photos.length}
        </p>
      </div>
    </dialog>
  );
}
