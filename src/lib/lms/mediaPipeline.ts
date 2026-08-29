/**
 * What an author's file becomes before it is stored.
 *
 * THE COST THIS EXISTS TO REMOVE. The route used to store the bytes it was
 * handed. A cover chosen from a phone's camera roll is three megabytes of
 * 4000px JPEG, and every one of those bytes then travelled to every visitor of
 * the catalogue — where the card that shows it is under 700px wide, and where
 * a dozen such cards sit on one screen. The size ceiling was the only thing
 * standing between the product and a 24 MB page, and a ceiling is not a
 * pipeline: it rejects the author's photo instead of preparing it.
 *
 * ONE PLACE, SERVER SIDE. The browser could downscale before it uploads, and
 * that would save the upload itself — but then the rule "what may be stored"
 * would exist twice, in a canvas and here, and the two would drift the first
 * time one of them was edited. The same reasoning that keeps the bucket without
 * a write policy keeps the resizing here: the route already holds the authority,
 * so the route holds the transform.
 *
 * WHAT THE AUTHOR IS ALLOWED TO HAND US. More than before, deliberately. The
 * input ceiling is 20 MB because a modern phone photo is routinely over five,
 * and "your picture is too big" is a sentence the product no longer needs to
 * say. What gets STORED is bounded by the renditions below, not by the input.
 */

import sharp from "sharp";

/** Widths that exist, largest first. The largest is also the canonical `src`. */
export const RENDITIONS = [1600, 640] as const;

/**
 * 1600px is the widest an image is ever drawn in this product — a lesson figure
 * on a wide screen, doubled for a retina panel — and past it the extra pixels
 * are stored, served and never seen.
 */
export const FULL_WIDTH = RENDITIONS[0];

/**
 * Below this the second rendition is not worth its own object: the file is
 * already small, and a card would download a barely-smaller image instead.
 */
const SMALL_ENOUGH_ALREADY = 900;

/** WebP at 80 is where a photograph stops improving to the eye and keeps growing. */
const QUALITY = 80;

/** 20 MB in, per the note above. */
export const MAX_INPUT_BYTES = 20 * 1024 * 1024;

/** The bucket's own ceiling. Nothing this module produces may exceed it. */
export const MAX_STORED_BYTES = 5 * 1024 * 1024;

export type Rendition = {
  /** Filename inside the image's own folder — `1600.webp`, `640.webp`, `original.gif`. */
  name: string;
  contentType: string;
  bytes: Uint8Array;
  width: number;
};

export type PreparedMedia = {
  /** Largest first; the first one is what `src` points at. */
  renditions: Rendition[];
  width: number;
  height: number;
  /** True when the file was stored as handed over rather than re-encoded. */
  verbatim: boolean;
};

export type PrepareFailure = { error: string };

function isFailure(value: PreparedMedia | PrepareFailure): value is PrepareFailure {
  return "error" in value;
}

export { isFailure as isPrepareFailure };

/**
 * ANIMATION IS THE ONE THING WE CANNOT IMPROVE CHEAPLY. Re-encoding an animated
 * GIF means decoding every frame and choosing a codec, and an animated WebP that
 * loses a frame is worse than the original that kept them. So an animation
 * passes through untouched, and pays for that with the old 5 MB ceiling — the
 * one the bucket enforces anyway.
 */
async function isAnimated(input: Buffer): Promise<boolean> {
  try {
    const meta = await sharp(input, { animated: true }).metadata();
    return (meta.pages ?? 1) > 1;
  } catch {
    return false;
  }
}

export async function prepareMedia(input: Buffer, contentType: string): Promise<PreparedMedia | PrepareFailure> {
  if (input.byteLength > MAX_INPUT_BYTES) {
    return { error: `media_too_large:${input.byteLength}` };
  }

  if (contentType === "image/gif" && (await isAnimated(input))) {
    if (input.byteLength > MAX_STORED_BYTES) {
      return { error: `media_animation_too_large:${input.byteLength}` };
    }
    const meta = await sharp(input, { animated: true }).metadata();
    return {
      renditions: [
        {
          name: "original.gif",
          contentType: "image/gif",
          bytes: new Uint8Array(input),
          width: meta.width ?? 0,
        },
      ],
      width: meta.width ?? 0,
      height: meta.pageHeight ?? meta.height ?? 0,
      verbatim: true,
    };
  }

  let meta: sharp.Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    // The declared content type said image and the bytes disagree. Worth its own
    // sentence to the author: "try again" would be a lie.
    return { error: "media_not_an_image" };
  }

  // `.rotate()` with no argument applies the EXIF orientation and drops the tag,
  // which is the only reason a portrait photo used to arrive sideways. It is
  // also, incidentally, where the rest of the EXIF goes: sharp writes no
  // metadata unless asked, so the author's GPS coordinates do not become a
  // public object.
  const upright = sharp(input).rotate();
  const rotated = (meta.orientation ?? 1) >= 5;
  const sourceWidth = (rotated ? meta.height : meta.width) ?? 0;
  const sourceHeight = (rotated ? meta.width : meta.height) ?? 0;

  const wanted = RENDITIONS.filter(
    (width) => width === FULL_WIDTH || (sourceWidth > SMALL_ENOUGH_ALREADY && width < sourceWidth),
  );

  const renditions: Rendition[] = [];
  for (const width of wanted) {
    const { data, info } = await upright
      .clone()
      // `withoutEnlargement` so a small original stays its own size rather than
      // being blown up into a bigger file that carries no more detail.
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer({ resolveWithObject: true });

    if (data.byteLength > MAX_STORED_BYTES) {
      // Only reachable for something pathological — a 1600px photograph is a
      // couple of hundred kilobytes. Better a named error than a bucket refusal
      // the author reads as "upload failed".
      return { error: `media_encode_too_large:${data.byteLength}` };
    }

    renditions.push({
      name: `${width}.webp`,
      contentType: "image/webp",
      bytes: new Uint8Array(data),
      width: info.width,
    });
  }

  // Two renditions of the same width are one rendition: a 700px original asked
  // for 1600 and got 700, and the 640 would be within a hair of it.
  const deduped = renditions.filter(
    (rendition, index) => index === 0 || rendition.width < renditions[index - 1].width * 0.9,
  );

  const stored = deduped[0];
  return {
    renditions: deduped,
    width: stored.width,
    height: sourceWidth > 0 ? Math.round((stored.width * sourceHeight) / sourceWidth) : 0,
    verbatim: false,
  };
}
