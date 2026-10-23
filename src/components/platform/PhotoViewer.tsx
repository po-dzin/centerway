"use client";

/**
 * ONE FULL-SCREEN PHOTO VIEWER for the whole platform (G 2026-10-18, made
 * shared 2026-10-21). It began as the feed's; G asked for the same viewer in
 * the builder, the library, products, course screenshots and generated images,
 * so it lives here and takes plain pictures — whoever opens it says what they
 * are and what the dialog is called.
 *
 * The picture at its own proportions in one night-glass frame over the
 * blurred page: its name and the close on the frame's head, the arrows, the
 * counter and the caller's actions on its foot.
 *
 * A native `<dialog>` opened modal, so focus stays inside, Escape closes it and
 * the page behind does not scroll. Left and right arrows on the keyboard, and
 * a swipe on a phone, turn the picture. Only photos the reader may see are
 * handed in: a spoiler still under its veil is not here.
 *
 * ACTIONS RIDE THE SAME ISLAND ROW (2026-10-23). The profile opens this viewer
 * on its own face, and the one thing worth doing from there is replacing it —
 * «Завантажити», as the design's viewer shows. A caller hands its controls in
 * through `actions` and they stand on the frame's foot beside the arrows; the
 * viewer stays one viewer. A single picture has no counter: «1 / 1» counts
 * nothing.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

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
  actions,
}: {
  photos: ViewerPhoto[];
  start: number;
  onClose: () => void;
  /** What the dialog is called for a screen reader, e.g. «Фото з допису». */
  label?: string;
  /** Controls for the bottom row, e.g. the profile's «Завантажити». Built from `onMedia` buttons. */
  actions?: ReactNode;
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
      {/* THE PLATFORM'S FRAME (G 23.10: «в общей платформенной рамке, а не
          тупо вот так»). The picture used to fill a black screen edge to edge
          with two loose islands on it — a browser's image view, not ours. It
          now stands in one night-glass frame over the blurred page: what this
          is and the way out on its head, the picture with the system's corner,
          and every control on its foot. Pressing outside the frame closes. */}
      <div className={styles.frame}>
        <div className={styles.head}>
          <span className={styles.title}>{label}</span>
          <button
            className={styles.close}
            type="button"
            aria-label={copy.close}
            onClick={() => dialog.current?.close()}
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className={styles.stage}>
          {/* eslint-disable-next-line @next/next/no-img-element -- each caller's own stored rendition */}
          <img
            className={styles.img}
            src={photo.src}
            width={photo.w || undefined}
            height={photo.h || undefined}
            alt={photo.alt}
          />
        </div>
        {photos.length > 1 || actions ? (
          <div className={styles.tools}>
            {photos.length > 1 ? (
              <>
                <button
                  className={styles.step}
                  type="button"
                  aria-label={copy.prev}
                  disabled={index === 0}
                  onClick={() => go(-1)}
                >
                  <Icon name="arrow-left" size={20} />
                </button>
                <p className={styles.count} aria-live="polite">
                  {index + 1} / {photos.length}
                </p>
                <button
                  className={styles.step}
                  type="button"
                  aria-label={copy.next}
                  disabled={index === last}
                  onClick={() => go(1)}
                >
                  <Icon name="arrow-right" size={20} />
                </button>
              </>
            ) : null}
            {actions ? <div className={styles.actions}>{actions}</div> : null}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
