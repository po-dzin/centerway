"use client";

/**
 * The author's gallery on `/expert/[slug]`: a grid of tiles, and one native
 * `<dialog>` that shows the pressed item large, with previous/next.
 *
 * NATIVE DIALOG for the reason the builder's sheet uses one: Escape, the focus
 * trap and the inert page come with the element. Arrow keys step through the
 * gallery while it is open.
 *
 * A VIDEO DOES NOT TALK TO YOUTUBE UNTIL IT IS OPENED. The tile is YouTube's
 * still with our play mark, the same idle state the hub's intro video draws;
 * the player iframe exists only inside the open dialog, and leaves with it.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import type { AuthorGalleryItem } from "@/lms-core";
import { youtubeEmbed, youtubePoster } from "@/lib/media/youtube";
import styles from "./AuthorProfileShowcase.module.css";

function itemLabel(item: AuthorGalleryItem, authorName: string, index: number): string {
  if (item.kind === "image") return item.alt;
  return item.caption || `Відео ${index + 1} · ${authorName}`;
}

/** Tiles the strip shows; the last one opens the rest when there are more. */
const STRIP_MAX = 6;

export function AuthorGallery({ items, authorName }: { items: AuthorGalleryItem[]; authorName: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<number | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (by: -1 | 1) => setOpen((current) => (current === null ? null : (current + by + items.length) % items.length)),
    [items.length],
  );

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open !== null && !node.open) node.showModal();
    if (open === null && node.open) node.close();
  }, [open]);

  useEffect(() => {
    if (open === null || items.length < 2) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, items.length, step]);

  const current = open === null ? null : items[open];

  return (
    <>
      {/* A STRIP INSIDE THE HEADER, NOT A SECTION OF ITS OWN (2026-10-14).
          It was a titled grid of large captioned tiles under the text blocks,
          and read as a separate page bolted on. Here it is a row of small
          squares under the author's own words — part of who they are, the
          way a profile shows its pictures. Captions live in the lightbox. */}
      <ul className={styles.galleryStrip} aria-label="Галерея">
        {items.slice(0, STRIP_MAX).map((item, index) => {
          const rest = index === STRIP_MAX - 1 ? items.length - STRIP_MAX : 0;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={styles.galleryTile}
                aria-label={
                  rest > 0
                    ? `Галерея: ще ${rest + 1}`
                    : item.kind === "video"
                      ? `Дивитися: ${itemLabel(item, authorName, index)}`
                      : item.alt
                }
                onClick={() => setOpen(index)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- the author's own public upload or YouTube's still; see AuthorPortrait */}
                <img
                  src={item.kind === "image" ? item.src : youtubePoster(item.videoId)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                {rest > 0 ? (
                  <span className={styles.galleryMore} aria-hidden="true">
                    +{rest + 1}
                  </span>
                ) : item.kind === "video" ? (
                  <span className={styles.galleryPlay} aria-hidden="true">
                    <Icon name="play" size={20} />
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <dialog
        ref={dialog}
        className={styles.lightbox}
        aria-label={current ? itemLabel(current, authorName, open ?? 0) : "Галерея"}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={close}
        onClick={(event) => {
          if (event.target === dialog.current) close();
        }}
      >
        {current ? (
          <div className={styles.lightboxBody}>
            <button type="button" className={styles.lightboxClose} aria-label="Закрити" onClick={close}>
              <Icon name="close" size={20} />
            </button>
            <figure className={styles.lightboxFigure}>
              {current.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element -- the author's own public upload
                <img className={styles.lightboxImage} src={current.src} alt={current.alt} />
              ) : (
                <div className={styles.lightboxVideo}>
                  <iframe
                    key={current.videoId}
                    src={youtubeEmbed(current.videoId)}
                    title={itemLabel(current, authorName, open ?? 0)}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              )}
              {current.caption ? <figcaption className={styles.lightboxCaption}>{current.caption}</figcaption> : null}
            </figure>
            {items.length > 1 ? (
              <div className={styles.lightboxNav}>
                <button type="button" className={styles.lightboxStep} aria-label="Попереднє" onClick={() => step(-1)}>
                  <Icon name="arrow-left" size={20} />
                </button>
                <span className={styles.lightboxCount}>
                  {(open ?? 0) + 1} / {items.length}
                </span>
                <button type="button" className={styles.lightboxStep} aria-label="Наступне" onClick={() => step(1)}>
                  <Icon name="arrow-right" size={20} />
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </dialog>
    </>
  );
}
