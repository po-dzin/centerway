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

/**
 * THERE IS NO SEPARATE "OPENING" SCALE ANY MORE (2026-09-06).
 *
 * A `CROP_SCALE_DEFAULT` of 1.15 lived here for a day, to give both axes room
 * to move in an editor that showed only the kept part of the picture: at
 * exactly `cover` one axis is flush with the frame by definition, so a drag on
 * it moved nothing and read as a broken control. Seeding a zoom answered the
 * symptom by quietly re-cropping every photograph already saved — 15% of its
 * edge gone the first time its author opened the cabinet and pressed save.
 *
 * The editor shows the whole photograph now (see the window model below), so
 * the flush axis is visible as a window against the picture's own edge rather
 * than felt as a dead gesture. An editor opens where the crop already is, and
 * an unset crop is still 1.
 */

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

/**
 * WHERE A DRAG PUTS THE FOCAL POINT — the picture follows the hand, one pixel
 * for one pixel.
 *
 * THE EDITORS USED TO TELEPORT. Pointer-down placed the focal point wherever
 * the cursor happened to land, so touching a photograph jumped it, and the only
 * way to understand the control was to read the grip badge painted on top of
 * the picture. Every crop tool a person has used since 2010 works the other way:
 * you grab the image and move it. Same stored model, opposite gesture.
 *
 * THE CONVERSION IS THE OVERFLOW, NOT THE FRAME. Under `object-fit: cover`,
 * moving `object-position` by one per cent moves the picture by one per cent OF
 * WHAT IS HIDDEN, not of the frame — so a 6:1 band and a square avatar convert
 * the same drag differently, and a photo with nothing hidden on an axis cannot
 * move on it at all. Dividing by the frame's own width instead would make the
 * picture race the hand on a tall crop and crawl on a wide one.
 *
 * `natural` at zero (an image still decoding) falls back to the frame, which is
 * the old behaviour's gain and never divides by nothing.
 */
/**
 * HOW MUCH PICTURE IS HIDDEN ON EACH AXIS — the pan's whole range, in pixels.
 *
 * One definition, because two consumers need the same answer and would answer
 * differently if each did the sum: `cropPan` divides by it, and the editor
 * draws a cursor from it so a hand is told which way a frame can move BEFORE it
 * tries and nothing happens.
 *
 * `natural` at zero (an image still decoding) falls back to the frame, which
 * keeps the old behaviour's gain and never divides by nothing.
 */
export function cropOverflow(
  frame: { width: number; height: number },
  natural: { width: number; height: number },
  scale: number
): { x: number; y: number } {
  const usable = natural.width > 0 && natural.height > 0;
  if (!usable) return { x: frame.width, y: frame.height };
  const cover = Math.max(frame.width / natural.width, frame.height / natural.height) * scale;
  return { x: natural.width * cover - frame.width, y: natural.height * cover - frame.height };
}

/* Half a pixel of overflow is no overflow: dividing by it would send the focal
   point to a clamp on the first twitch of the hand. */
export const CROP_PAN_EPSILON = 0.5;

export const cropCanPan = (overflow: { x: number; y: number }) => ({
  x: overflow.x > CROP_PAN_EPSILON,
  y: overflow.y > CROP_PAN_EPSILON,
});

export function cropPan(
  start: { x: number; y: number },
  delta: { dx: number; dy: number },
  frame: { width: number; height: number },
  natural: { width: number; height: number },
  scale: number
): { x: number; y: number } {
  const overflow = cropOverflow(frame, natural, scale);
  const can = cropCanPan(overflow);
  return {
    x: can.x ? clampCropAxis(start.x - (delta.dx / overflow.x) * 100) : clampCropAxis(start.x),
    y: can.y ? clampCropAxis(start.y - (delta.dy / overflow.y) * 100) : clampCropAxis(start.y),
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   THE OTHER WAY ROUND: A WHOLE PHOTOGRAPH WITH A WINDOW ON IT (2026-09-06)

   Everything above renders a crop — a frame already filled by `cover`, with the
   discarded edges outside the box and therefore off the screen. That is right
   for every public surface, and wrong for the one place a person CHOOSES the
   crop: an author dragging a portrait inside a card frame could see only what
   was already kept, never what was about to be lost, and at scale 1 one axis is
   flush by definition, so the drag on it had nothing to move and the whole
   control read as dead ("I crop and the photo just stays").

   The editor inverts the picture. It draws the WHOLE photograph, dims it, and
   lays the frame over it as a bright window — so the crop is a thing you can
   see the edges of, and the reason an axis will not move is on screen before
   the hand tries it. What is stored does not change by one field: the window's
   position IS `{x, y}` (the same per cent of the slack that `object-position`
   means under `cover`) and its size IS `scale` (the inscribed window at 1,
   shrinking as the picture magnifies). The two models are the same geometry
   read from opposite sides, which is why nothing already saved re-crops.
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Where an `object-fit: contain` image actually lands inside its box — the
 * editor's stage shows the whole photograph, so it needs the drawn rectangle
 * rather than the box, and the letterboxed paper on either side belongs to
 * neither the picture nor the crop.
 *
 * `natural` at zero (an image still decoding) falls back to the whole stage,
 * which is where a `contain` image with no known ratio is painted anyway.
 */
export function containRect(
  stage: { width: number; height: number },
  natural: { width: number; height: number }
): { left: number; top: number; width: number; height: number } {
  const usable = natural.width > 0 && natural.height > 0 && stage.width > 0 && stage.height > 0;
  if (!usable) return { left: 0, top: 0, width: stage.width, height: stage.height };
  const fit = Math.min(stage.width / natural.width, stage.height / natural.height);
  const width = natural.width * fit;
  const height = natural.height * fit;
  return { left: (stage.width - width) / 2, top: (stage.height - height) / 2, width, height };
}

/**
 * The bright window, in the drawn photograph's own pixels.
 *
 * AT SCALE 1 IT IS THE LARGEST RECTANGLE OF THAT SHAPE THE PHOTOGRAPH HOLDS —
 * which is exactly what `cover` keeps, seen from the other side. So the two
 * ends of the slider mean what they always meant: 1 is "as much of this
 * picture as this shape can take", 4 is the pipeline's last sharp stop.
 *
 * `ratio` is width ÷ height and is read from the frame's own CSS by the editor,
 * so the shapes stay declared once (`--ds-author-banner-ratio` and friends)
 * rather than retyped as a number here.
 */
export function cropWindowRect(
  photo: { width: number; height: number },
  ratio: number,
  scale: number,
  crop: { x: number; y: number }
): { left: number; top: number; width: number; height: number } {
  if (!(photo.width > 0 && photo.height > 0 && ratio > 0)) {
    return { left: 0, top: 0, width: photo.width, height: photo.height };
  }
  const inscribed =
    photo.width / photo.height > ratio
      ? { width: photo.height * ratio, height: photo.height }
      : { width: photo.width, height: photo.width / ratio };
  const zoom = Math.max(CROP_SCALE_MIN, scale);
  const width = inscribed.width / zoom;
  const height = inscribed.height / zoom;
  return {
    left: (clampCropAxis(crop.x) / 100) * (photo.width - width),
    top: (clampCropAxis(crop.y) / 100) * (photo.height - height),
    width,
    height,
  };
}

/**
 * WHAT MOVES IS WHAT YOU GRABBED. On the editor's stage the photograph is the
 * fixed thing — it is the map — and the window is what the hand carries over
 * it, so a drag right moves the window right and the stored focus rises. That
 * is the opposite sign to `cropPan`, which is correct for the opposite picture:
 * there the frame is fixed and the photograph slides under it.
 *
 * The slack, not the stage, is the conversion: a window that fills the photo on
 * an axis has nowhere to go on it, and dividing by the photograph's width there
 * would send the focus to a clamp on the first twitch of the hand.
 */
export function cropWindowPan(
  start: { x: number; y: number },
  delta: { dx: number; dy: number },
  photo: { width: number; height: number },
  window: { width: number; height: number }
): { x: number; y: number } {
  const slack = { x: photo.width - window.width, y: photo.height - window.height };
  return {
    x: slack.x > CROP_PAN_EPSILON ? clampCropAxis(start.x + (delta.dx / slack.x) * 100) : clampCropAxis(start.x),
    y: slack.y > CROP_PAN_EPSILON ? clampCropAxis(start.y + (delta.dy / slack.y) * 100) : clampCropAxis(start.y),
  };
}

/**
 * `aspect-ratio` as CSS reports it — `"5 / 1"`, `"1"`, or `"auto"` when the
 * frame never stated one. Parsed rather than retyped so the editor's window and
 * the public frame keep reading ONE declaration (see the assertion in
 * surfaceBoundaries.test.ts that holds the banner's two frames together).
 */
export function parseCssRatio(value: string | null | undefined): number | null {
  if (!value) return null;
  const [w, h = "1"] = value.split("/").map((part) => part.trim());
  const width = Number(w);
  const height = Number(h);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return width / height;
}
