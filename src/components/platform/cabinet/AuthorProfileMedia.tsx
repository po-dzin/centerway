"use client";

/**
 * The photograph slots and their crop preview, and the required-field mark.
 *
 * Split out of AuthorProfileFold.tsx (1,573 lines) on 2026-09-11; nothing inside any declaration changed.
 */

import { useId, useState, type ChangeEvent, type CSSProperties } from "react";
import { Icon } from "@/components/Icon";
import { cropStyle } from "@/lib/media/imageCrop";
import styles from "./Cabinet.module.css";
import { PHOTO_CROP_FRAME } from "./AuthorProfileFold";

export type PhotoCropShape = "card" | "avatar" | "banner";

/**
 * HEIC AND HEIF ARE ON THE LIST NOW, and the upload route still does not take
 * them. That is not a contradiction: an iPhone left on "keep originals" hands
 * over `image/heic`, `shrinkForUpload` re-encodes anything the browser can
 * decode into JPEG, and JPEG is what the route sees. Leaving them off the list
 * did not protect anything — it made the picker grey out the photograph the
 * author was pointing at.
 */
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif";

/**
 * THE RESTING FRAME — the picture as the page will print it, and the way in.
 *
 * It used to be the editor too: you dragged the photograph inside this box and
 * a slider under it magnified. That made the one place an author chooses a crop
 * the one place they could not see what the crop discards, and at scale 1 the
 * `cover` fit is flush on one axis, so half the drags moved nothing at all.
 *
 * So it stopped editing and went back to being what it is best at: the exact
 * frame `/expert/[slug]` and `AuthorCard` draw, in the composition they draw it
 * in, so this fold still reads as a preview of the page it writes. Pressing it
 * opens `CropEditor`, which shows the whole photograph with this frame over it.
 * The frame hands its own `aspect-ratio` and `border-radius` to that editor, so
 * the shape stays declared once — in CSS — for both.
 */
export function PhotoCropPreview({
  src,
  alt,
  shape,
  x,
  y,
  scale,
  label,
  busy,
  onOpen,
}: {
  src: string;
  alt: string;
  shape: PhotoCropShape;
  x: number;
  y: number;
  /** 1–4, the frame's magnification about its own focus point. */
  scale: number;
  label: string;
  /** An upload is in flight for THIS frame's image. */
  busy?: boolean;
  onOpen: (frame: HTMLElement) => void;
}) {
  const frameClass = PHOTO_CROP_FRAME[shape].className;
  return (
    <button
      type="button"
      className={styles[frameClass]}
      /* ON THE PICTURE, BECAUSE THAT IS WHERE THE EYE IS. The only sign an
         upload was running used to be a line of text below the crop grid and
         the alt field — on a phone, a screen and a half under the thumb that
         just picked the file. */
      data-busy={busy || undefined}
      disabled={busy}
      aria-label={label}
      onClick={(event) => onOpen(event.currentTarget)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- the cabinet's own upload, any public host */}
      <img src={src} alt={alt} style={cropStyle({ x, y, scale }, { x: 50, y: 50 })} draggable={false} />
      {/* The affordance, in the one corner the replace/remove pair never takes.
          A frame that opens an editor has to say so: without a mark it is a
          photograph, and photographs are not usually buttons. */}
      <span className={styles.photoCropOpen} aria-hidden="true">
        <Icon name="edit" size={15} />
      </span>
    </button>
  );
}

/**
 * The photo and the background share one frame: an image once there is one, a
 * clickable dashed slot before there is — dragged onto or picked through the
 * same hidden input — and a corner replace/remove pair once it is filled.
 *
 * Reused rather than written twice: the two fields used to diverge on exactly
 * this, and the background's empty slot was invisible — its span asked for
 * `width: 100%` inside a `width: fit-content` frame, a circular size neither
 * browser resolves to anything but zero. One component means there is only
 * one place this can go wrong again.
 */
export function AuthorMediaSlot({
  src,
  previewClassName,
  emptyClassName,
  uploadLabel,
  replaceLabel,
  removeLabel,
  dropLabel,
  uploading,
  onFile,
  onRemove,
}: {
  src: string | undefined;
  /* Both come straight from a CSS module, whose lookups are `string |
     undefined`; React treats a missing className the same as an absent one. */
  previewClassName: string | undefined;
  emptyClassName: string | undefined;
  uploadLabel: string;
  replaceLabel: string;
  removeLabel: string;
  dropLabel: string;
  uploading: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onFile(file);
  };

  return (
    <div
      className={styles.authorMediaFrame}
      data-drag-over={dragOver || undefined}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDragOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const file = event.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={previewClassName} src={src} alt="" />
      ) : (
        <label className={emptyClassName} aria-label={uploadLabel}>
          <input
            className={styles.visuallyHidden}
            type="file"
            aria-label={uploadLabel}
            accept={PHOTO_ACCEPT}
            disabled={uploading}
            onChange={pick}
          />
          <Icon name="import" size={22} />
          <span>{dragOver ? dropLabel : uploadLabel}</span>
        </label>
      )}
      {src ? (
        <div className={styles.authorMediaActions}>
          <label className={styles.authorMediaAction} aria-label={replaceLabel} title={replaceLabel}>
            <input
              className={styles.visuallyHidden}
              type="file"
              aria-label={replaceLabel}
              accept={PHOTO_ACCEPT}
              disabled={uploading}
              onChange={pick}
            />
            <Icon name="edit" size={18} />
          </label>
          <button
            type="button"
            className={styles.authorMediaAction}
            aria-label={removeLabel}
            title={removeLabel}
            onClick={onRemove}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * A field that is only sometimes required — the badges are, once the profile
 * is public — marked once, here, rather than as prose in parentheses after
 * every label that needs it. `title` is a real hover tooltip; the visually
 * hidden text is what a screen reader says instead of a bare asterisk.
 */
export function RequiredMark({ tooltip }: { tooltip: string }) {
  const id = useId();
  /* A NAME PER MARK. `anchor-name` written once in the stylesheet gives every
     mark on the page the SAME name, and a popover then anchors to the last
     element carrying it — measured 227px away, beside a different field.
     The name has to be per instance, so it comes from `useId` here; the
     stylesheet keeps the geometry. */
  const anchor = `--cw-required-${id.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <>
      <button
        type="button"
        className={styles.authorRequiredMark}
        style={{ anchorName: anchor } as CSSProperties}
        popoverTarget={id}
        aria-label={tooltip}
      >
        *
      </button>
      <span
        className={styles.authorRequiredHint}
        style={{ positionAnchor: anchor } as CSSProperties}
        popover="auto"
        id={id}
      >
        {tooltip}
      </span>
    </>
  );
}
