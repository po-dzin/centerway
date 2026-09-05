import type { CSSProperties } from "react";

/**
 * ONE CROP MODEL FOR EVERY FRAME THE PRODUCT CROPS INTO — an author's card and
 * round avatar, a course's 16:9 card, its wide hero and its portrait hero.
 *
 * WHAT A CROP IS HERE. A focal point and a magnification, not a rectangle. The
 * frames are already fixed shapes filled with `object-fit: cover`, so the only
 * two things left undecided are WHICH point of the photograph must survive the
 * fill and HOW CLOSE the frame stands to it. `{x, y, scale}` says both, in two
 * numbers a slider can carry and one a drag already did.
 *
 * WHY NOT A STORED RECTANGLE. A rectangle is an answer to one frame. The same
 * author photo is read through a 3:4 card and a circle; the same cover through
 * 16:9, 21:9 and 9:16. A rect chosen in one of those is wrong in the others,
 * and storing five rects is storing the same photograph five times. A focal
 * point composes with whatever shape asks for it — which is why the platform
 * had focal points before it had zoom, and why zoom joins them rather than
 * replacing them.
 *
 * WHY NOT BAKE THE CROP INTO A FILE. Re-cropping would then need the master
 * kept beside every rendition, and every surface that already renders the
 * photo would go on rendering yesterday's crop until a job caught up. The crop
 * is a view onto one stored image, so changing it is one row and takes effect
 * the moment the page next renders.
 */
export type ImageCrop = {
  /** 0–100, per cent of the image's own width. */
  x?: number;
  /** 0–100, per cent of the image's own height. */
  y?: number;
  /** 1–4. 1 is the whole frame as `cover` fills it; absent means 1. */
  scale?: number;
};

/**
 * The ceiling is 4 and not "as far as you like". `FULL_WIDTH` in
 * mediaPipeline.ts is 1600px and the pipeline never enlarges, so a 4× frame is
 * already reading a 400px-wide window of the widest rendition that exists — at
 * the card sizes these frames actually render, that is the last stop before
 * the photograph visibly falls apart. A slider that can reach a blurred result
 * is a slider that ships blurred results.
 */
export const CROP_SCALE_MIN = 1;
export const CROP_SCALE_MAX = 4;
export const CROP_SCALE_STEP = 0.05;

export const clampCropAxis = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export const clampCropScale = (value: number) =>
  Math.max(CROP_SCALE_MIN, Math.min(CROP_SCALE_MAX, Math.round(value * 100) / 100));

/** True for a crop that magnifies — the test every renderer uses to stay cheap. */
export const cropIsZoomed = (scale: number | undefined) =>
  typeof scale === "number" && Number.isFinite(scale) && scale > CROP_SCALE_MIN;

/**
 * The style a cropped `<img>` carries. Pair it with a frame that fills itself
 * (`object-fit: cover`) and clips (`overflow: hidden`) — every frame in this
 * product already does both.
 *
 * WHY `transform-origin` REPEATS THE POSITION. Under `cover`, `object-position:
 * X% Y%` puts the point at X%,Y% OF THE IMAGE at X%,Y% OF THE BOX. Scaling
 * about that same point of the box therefore leaves the focal point exactly
 * where it was and grows the picture around it — which is what "zoom in on
 * this" means, and what a scale about the box's centre would not do.
 *
 * NO `transform` AT ALL WHEN SCALE IS 1. A transform promotes the image to its
 * own layer, and almost every photo in the product is unzoomed. Paying a layer
 * per portrait on a directory page for a `scale(1)` that changes nothing is the
 * `will-change` trap under a different name (one-topbar-material, 2026-08-29).
 */
export function cropStyle(crop: ImageCrop | undefined, fallback: { x: number; y: number }): CSSProperties {
  const x = crop?.x ?? fallback.x;
  const y = crop?.y ?? fallback.y;
  const position = `${x}% ${y}%`;
  const scale = crop?.scale;
  if (!cropIsZoomed(scale)) return { objectPosition: position };
  return { objectPosition: position, transformOrigin: position, transform: `scale(${scale})` };
}

/**
 * The same crop for a layer painted with `background-image` rather than an
 * `<img>`.
 *
 * IT SCALES THE LAYER, NOT `background-size`. There is no way to say "cover,
 * times 1.4" in `background-size` — a percentage there is measured against the
 * box and abandons the `cover` fit entirely, which uncovers an edge the moment
 * the image's aspect ratio differs from its frame's. So the layer keeps
 * `cover` and takes a transform, which means the layer needs a parent that
 * clips it: see `.bannerFrame` in AuthorProfileShowcase.module.css.
 */
export function cropBackgroundStyle(crop: ImageCrop | undefined, fallback: { x: number; y: number }): CSSProperties {
  const x = crop?.x ?? fallback.x;
  const y = crop?.y ?? fallback.y;
  const position = `${x}% ${y}%`;
  const scale = crop?.scale;
  if (!cropIsZoomed(scale)) return { backgroundPosition: position };
  return { backgroundPosition: position, transformOrigin: position, transform: `scale(${scale})` };
}
