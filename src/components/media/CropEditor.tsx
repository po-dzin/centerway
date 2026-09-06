"use client";

/**
 * CHOOSING A CROP BY SEEING THE WHOLE PICTURE (2026-09-06).
 *
 * The resting frames in the cabinet are the page: a band, a round portrait over
 * its edge, a card — each drawn exactly as `/expert/[slug]` will draw it, which
 * is the point of that fold. What they cannot be at the same time is an editor.
 * A frame filled by `cover` shows only what survives, so an author aiming it was
 * choosing between things they could not see, and at scale 1 one axis is flush
 * by definition — the drag on it moved nothing, and a control that does nothing
 * when pulled is reported as broken, which is how this arrived.
 *
 * So the choosing happens here instead, on a stage that shows the ENTIRE
 * photograph, dimmed, with the frame over it as a bright window. Zoom shrinks
 * the window rather than magnifying a picture already off both edges of its box.
 * Nothing about what is stored changes: the window's position is `{x, y}` and
 * its size is `scale`, the same two numbers every public surface already reads
 * (`cropWindowRect` in src/lib/media/imageCrop.ts says why those are the same
 * geometry seen from the other side).
 *
 * THE SHAPE IS NOT DECLARED HERE, AND NOT COPIED HERE EITHER. The window is
 * shaped by the resting frame that opened it: the caller reads `aspect-ratio`
 * and `border-radius` off that element and hands them over resolved, so a
 * banner's 5:1 (`--ds-author-banner-ratio`, the token the public page reads),
 * the card's 24:29 and the avatar's circle stay stated exactly once — in CSS —
 * and any future change to them reaches this editor without being retyped.
 */

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";

import { Icon } from "@/components/Icon";
import { CropZoom, cropKeyZoom, cropWheelZoom } from "@/components/media/CropZoom";
import {
  clampCropAxis,
  containRect,
  cropWindowPan,
  cropWindowRect,
  parseCssRatio,
} from "@/lib/media/imageCrop";
import styles from "./CropEditor.module.css";

export type CropEditorLabels = {
  /** Names the stage for a screen reader — "Frame. Drag the window…". */
  stage: string;
  zoom: string;
  reset: string;
  done: string;
  /** "Focus: {x}% across, {y}% down" — the live region under the stage. */
  position: (x: number, y: number) => string;
};

const EMPTY_RECT = { left: 0, top: 0, width: 0, height: 0 };

export function CropEditor({
  src,
  alt,
  title,
  note,
  ratio,
  radius,
  x,
  y,
  scale,
  onChange,
  onScaleChange,
  onReset,
  onClose,
  labels,
}: {
  src: string;
  alt: string;
  title: string;
  note?: string;
  /** `aspect-ratio` as the resting frame computes it — e.g. `"5 / 1"`. */
  ratio: string;
  /** `border-radius` as the resting frame computes it — a circle stays round. */
  radius: string;
  x: number;
  y: number;
  scale: number;
  onChange: (x: number, y: number) => void;
  onScaleChange: (scale: number) => void;
  onReset: () => void;
  onClose: () => void;
  labels: CropEditorLabels;
}) {
  const titleId = useId();
  const positionId = useId();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const activePointer = useRef<number | null>(null);
  /* Where the hand and the crop both were when the drag began — deltas are
     measured from HERE, so the integers the crop is stored as cannot accumulate
     a rounding drift across a long drag. */
  const origin = useRef({ pointerX: 0, pointerY: 0, x: 50, y: 50 });
  const [dragging, setDragging] = useState(false);
  /* The drawn photograph inside the stage — measured rather than assumed: the
     stage is fluid and the photograph arrives late. */
  const [photo, setPhoto] = useState(EMPTY_RECT);
  const shape = parseCssRatio(ratio) ?? 1;

  const measure = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const box = stage.getBoundingClientRect();
    const image = imageRef.current;
    setPhoto(
      containRect(
        { width: box.width, height: box.height },
        { width: image?.naturalWidth ?? 0, height: image?.naturalHeight ?? 0 }
      )
    );
  }, []);

  useLayoutEffect(() => {
    measure();
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    const image = imageRef.current;
    image?.addEventListener("load", measure);
    return () => {
      observer.disconnect();
      image?.removeEventListener("load", measure);
    };
  }, [measure, src]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* The stage takes the focus when it opens: the whole point of this overlay is
     the one control in it, and landing on the dialog's paper instead would make
     the keyboard user hunt for it. */
  useEffect(() => {
    stageRef.current?.focus();
  }, []);

  const frame = cropWindowRect(photo, shape, scale, { x, y });

  const panTo = (event: PointerEvent<HTMLDivElement>) => {
    const next = cropWindowPan(
      { x: origin.current.x, y: origin.current.y },
      { dx: event.clientX - origin.current.pointerX, dy: event.clientY - origin.current.pointerY },
      photo,
      frame
    );
    onChange(next.x, next.y);
  };

  const beginDrag = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointer.current = event.pointerId;
    origin.current = { pointerX: event.clientX, pointerY: event.clientY, x, y };
    setDragging(true);
  };

  const drag = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return;
    panTo(event);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null;
    setDragging(false);
  };

  const moveByKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 5 : 2;
    if (cropKeyZoom(scale, event.key, onScaleChange)) {
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowLeft") onChange(clampCropAxis(x - step), y);
    else if (event.key === "ArrowRight") onChange(clampCropAxis(x + step), y);
    else if (event.key === "ArrowUp") onChange(x, clampCropAxis(y - step));
    else if (event.key === "ArrowDown") onChange(x, clampCropAxis(y + step));
    else return;
    event.preventDefault();
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className={styles.scrim} role="presentation" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className={styles.head}>
          <div className={styles.headText}>
            <h2 className={styles.title} id={titleId}>{title}</h2>
            {note ? <p className={styles.note}>{note}</p> : null}
          </div>
          <button type="button" className={styles.action} onClick={onClose} aria-label={labels.done} title={labels.done}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <div
          ref={stageRef}
          className={styles.stage}
          data-dragging={dragging || undefined}
          tabIndex={0}
          role="group"
          aria-label={labels.stage}
          aria-describedby={positionId}
          onKeyDown={moveByKey}
          onWheel={(event) => cropWheelZoom(scale, event, onScaleChange)}
          onPointerDown={beginDrag}
          onPointerMove={drag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- the cabinet's own upload, any public host */}
          <img ref={imageRef} src={src} alt={alt} draggable={false} />
          <div
            className={styles.window}
            style={{
              left: `${photo.left + frame.left}px`,
              top: `${photo.top + frame.top}px`,
              width: `${frame.width}px`,
              height: `${frame.height}px`,
              borderRadius: radius,
            }}
            aria-hidden="true"
          >
            <span className={styles.guides} />
          </div>
        </div>
        <p className={styles.note} id={positionId} role="status">{labels.position(x, y)}</p>
        <div className={styles.foot}>
          <CropZoom className={styles.zoom} value={scale} onChange={onScaleChange} label={labels.zoom} />
          <button type="button" className={styles.action} onClick={onReset} aria-label={labels.reset} title={labels.reset}>
            <Icon name="undo" size={20} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
