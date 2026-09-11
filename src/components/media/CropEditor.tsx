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

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";

import { Icon } from "@/components/Icon";
import { cropKeyZoom, cropWheelZoom } from "@/components/media/CropZoom";
import {
  CROP_PAN_EPSILON,
  CROP_SCALE_MAX,
  CROP_SCALE_MIN,
  clampCropAxis,
  clampCropScale,
  containRect,
  cropWindowPan,
  cropWindowRect,
  parseCssRatio,
} from "@/lib/media/imageCrop";
import styles from "./CropEditor.module.css";

export type CropEditorLabels = {
  /** Names the stage for a screen reader — "Frame. Drag the window…". */
  stage: string;
  /** Names the keyboard path to the size, now that the slider is gone. */
  zoom: string;
  reset: string;
  done: string;
  /** "Focus: {x}% across, {y}% down" — the live region under the stage. */
  position: (x: number, y: number) => string;
};

const EMPTY_RECT = { left: 0, top: 0, width: 0, height: 0 };

/**
 * THE WINDOW IS RESIZED BY ITS OWN CORNERS (2026-09-11), and that is the only
 * way it is resized.
 *
 * It had a slider under the stage. A slider is a number; the thing the number
 * described was on screen the whole time, with four corners asking to be
 * pulled — and pulling them did nothing, which is the same "the control that
 * looks like the control is inert" this editor was built to end. So the corners
 * do the work and the slider is gone rather than kept as a second way in.
 *
 * The ratio never changes: a window is the shape the page will print, so a
 * corner scales it and never reshapes it. The OPPOSITE corner is the anchor, so
 * the edge under the other hand stays where the eye left it.
 */
const CORNERS = ["nw", "ne", "sw", "se"] as const;
type Corner = (typeof CORNERS)[number];

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
  axis = "both",
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
  /**
   * Which way the window may move.
   *
   * `both` for a frame that owns its whole crop. `y` for one that follows
   * another frame horizontally and only decides its own vertical — the course
   * cover's ultra-wide hero is that: it shares the card's x by contract, and an
   * editor that let the hand drag x would be moving a number it then refuses to
   * store, which is the exact "pulled and nothing happened" this editor exists
   * to end.
   */
  axis?: "both" | "y";
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
  /* THE CORNER THAT STAYS PUT while its opposite is dragged, in photo-space
     pixels, plus which corner is in the hand. Set on pointer-down and read on
     every move, so a resize is anchored rather than integrated — the same
     reason the pan keeps its own origin. */
  const resizing = useRef<{ corner: Corner; anchorX: number; anchorY: number } | null>(null);
  const [resizingCorner, setResizingCorner] = useState<Corner | null>(null);
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
        { width: image?.naturalWidth ?? 0, height: image?.naturalHeight ?? 0 },
      ),
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
      frame,
    );
    onChange(axis === "y" ? x : next.x, next.y);
  };

  /* The largest window this ratio can take on this photograph — the size at
     scale 1, which is what `cropWindowRect` divides by. Resizing is the same
     arithmetic read backwards: a width chosen by the hand IS a scale. */
  const inscribed = cropWindowRect(photo, shape, CROP_SCALE_MIN, { x: 0, y: 0 });

  const pointerInPhoto = (event: PointerEvent<Element>) => {
    const box = stageRef.current?.getBoundingClientRect();
    if (!box) return null;
    return { x: event.clientX - box.left - photo.left, y: event.clientY - box.top - photo.top };
  };

  const beginResize = (corner: Corner) => (event: PointerEvent<HTMLSpanElement>) => {
    /* The stage would read this as the start of a pan, and the window would
       both move and grow under one finger. */
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    /* NOT `activePointer` — that one belongs to the pan. Sharing it meant the
       stage's own move handler recognised this pointer as its drag, so a
       resize also panned, and the pan wrote last: the window shrank AND
       jumped to the corner. Two gestures, two ids. */
    resizing.current = {
      corner,
      anchorX: corner === "nw" || corner === "sw" ? frame.left + frame.width : frame.left,
      anchorY: corner === "nw" || corner === "ne" ? frame.top + frame.height : frame.top,
    };
    setResizingCorner(corner);
  };

  const resizeTo = (event: PointerEvent<HTMLSpanElement>) => {
    event.stopPropagation();
    const grip = resizing.current;
    const point = pointerInPhoto(event);
    if (!grip || !point || inscribed.width <= 0) return;

    /* One number decides the size, and it is the bolder of the two the hand
       offers: a corner pulled mostly sideways should still grow, and a ratio
       cannot honour both axes at once. */
    const byWidth = Math.abs(point.x - grip.anchorX);
    const byHeight = Math.abs(point.y - grip.anchorY) * shape;
    const width = Math.max(inscribed.width / CROP_SCALE_MAX, Math.min(inscribed.width, Math.max(byWidth, byHeight)));
    const height = width / shape;

    /* The anchor holds: the window grows away from the corner nobody is
       touching, then is pushed back inside the photograph if it ran past an
       edge. Clamping the POSITION rather than refusing the size is what keeps
       a drag into the corner from stalling. */
    const left = grip.corner === "nw" || grip.corner === "sw" ? grip.anchorX - width : grip.anchorX;
    const top = grip.corner === "nw" || grip.corner === "ne" ? grip.anchorY - height : grip.anchorY;
    const slackX = photo.width - width;
    const slackY = photo.height - height;

    onScaleChange(clampCropScale(inscribed.width / width));
    onChange(
      axis === "y" || slackX <= CROP_PAN_EPSILON
        ? x
        : clampCropAxis((Math.min(Math.max(left, 0), slackX) / slackX) * 100),
      slackY <= CROP_PAN_EPSILON ? y : clampCropAxis((Math.min(Math.max(top, 0), slackY) / slackY) * 100),
    );
  };

  const endResize = (event: PointerEvent<HTMLSpanElement>) => {
    event.stopPropagation();
    resizing.current = null;
    setResizingCorner(null);
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
    if (event.key === "ArrowLeft") onChange(axis === "y" ? x : clampCropAxis(x - step), y);
    else if (event.key === "ArrowRight") onChange(axis === "y" ? x : clampCropAxis(x + step), y);
    else if (event.key === "ArrowUp") onChange(x, clampCropAxis(y - step));
    else if (event.key === "ArrowDown") onChange(x, clampCropAxis(y + step));
    else return;
    event.preventDefault();
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={styles.scrim}
      role="presentation"
      onPointerDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className={styles.panel} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className={styles.head}>
          <div className={styles.headText}>
            <h2 className={styles.title} id={titleId}>
              {title}
            </h2>
            {note ? <p className={styles.note}>{note}</p> : null}
          </div>
          <button
            type="button"
            className={styles.action}
            onClick={onClose}
            aria-label={labels.done}
            title={labels.done}
          >
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
            data-resizing={resizingCorner ?? undefined}
          >
            <span className={styles.guides} aria-hidden="true" />
            {CORNERS.map((corner) => (
              <span
                key={corner}
                className={styles.grip}
                data-corner={corner}
                aria-hidden="true"
                onPointerDown={beginResize(corner)}
                onPointerMove={resizeTo}
                onPointerUp={endResize}
                onPointerCancel={endResize}
              />
            ))}
          </div>
        </div>
        <p className={styles.note} id={positionId} role="status">
          {labels.position(x, y)}
        </p>
        {/* WHERE THE SLIDER WAS, a sentence instead. The gesture that replaced
            it is on screen — four corners on the window — but a gesture with no
            words is a gesture half the readers never find. */}
        <p className={styles.note}>{labels.zoom}</p>
        <div className={styles.foot}>
          <button
            type="button"
            className={styles.action}
            onClick={onReset}
            aria-label={labels.reset}
            title={labels.reset}
          >
            <Icon name="undo" size={20} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
