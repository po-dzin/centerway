import type { CSSProperties } from "react";

import { cropStyle, cropIsZoomed, type ImageCrop } from "@/lib/media/imageCrop";
import type { Course } from "@/lms-core";

type Cover = NonNullable<Course["cover"]>;

/**
 * Where a course cover is looked at, per frame, and how close.
 *
 * ONE READER FOR FIVE WRITERS. The cover's crop numbers were read in six
 * places — the cabinet's card, the builder's grid, the builder's own preview,
 * `offers.ts`, `courseOffer.ts` — each spelling out the same
 * `${cropX ?? 50}% ${cropY ?? 50}%` by hand, and each therefore free to
 * disagree about the fallback. Adding the zoom to six literals is how they
 * would have finished disagreeing, so they read from here instead.
 */
export const COVER_CROP_DEFAULT = { x: 50, y: 50 };

/** The 16:9 frame — every card, and the hero up to 16:9. */
export function coverLandscapeCrop(cover: Cover | undefined): ImageCrop {
  return { x: cover?.cropX, y: cover?.cropY, scale: cover?.cropScale };
}

/**
 * The frame past 16:9. It borrows the landscape x — the wide hero crops top and
 * bottom, so there is nothing for a second horizontal focus to answer — and
 * takes its own y and its own zoom.
 */
export function coverWideCrop(cover: Cover | undefined): ImageCrop {
  return {
    x: cover?.cropX,
    y: cover?.wideCropY ?? cover?.cropY,
    scale: cover?.wideCropScale ?? cover?.cropScale,
  };
}

/** The 9:16 frame, on the portrait master when there is one. */
export function coverPortraitCrop(cover: Cover | undefined): ImageCrop {
  return {
    x: cover?.mobileCropX ?? cover?.cropX,
    y: cover?.mobileCropY ?? cover?.cropY,
    scale: cover?.mobileCropScale ?? cover?.cropScale,
  };
}

/** `object-position` for a frame, as the CSS strings the offer surfaces carry. */
export function coverPosition(crop: ImageCrop): string {
  return `${crop.x ?? COVER_CROP_DEFAULT.x}% ${crop.y ?? COVER_CROP_DEFAULT.y}%`;
}

/** The magnification a surface should declare, or nothing when there is none. */
export function coverScale(crop: ImageCrop): number | undefined {
  return cropIsZoomed(crop.scale) ? crop.scale : undefined;
}

/** The full style for a cover drawn as an `<img>` — the cabinet and builder cards. */
export function coverCardStyle(cover: Cover | undefined): CSSProperties {
  return cropStyle(coverLandscapeCrop(cover), COVER_CROP_DEFAULT);
}

/**
 * The three frames an offer surface publishes, in the shape
 * `PlatformOfferArtwork` names them.
 */
export function coverArtworkFraming(cover: Cover): {
  desktopPosition: string;
  mobilePosition: string;
  widePosition?: string;
  desktopScale?: number;
  mobileScale?: number;
  wideScale?: number;
} {
  const landscape = coverLandscapeCrop(cover);
  const portrait = coverPortraitCrop(cover);
  const wide = coverWideCrop(cover);
  return {
    desktopPosition: coverPosition(landscape),
    mobilePosition: coverPosition(portrait),
    /* Only when the author said something about it: absent means "same as the
       landscape frame", which is what the hero contract already resolves to. */
    ...(cover.wideCropY !== undefined || cover.wideCropScale !== undefined
      ? { widePosition: coverPosition(wide) }
      : {}),
    ...(coverScale(landscape) !== undefined ? { desktopScale: coverScale(landscape) } : {}),
    ...(coverScale(portrait) !== undefined ? { mobileScale: coverScale(portrait) } : {}),
    ...(coverScale(wide) !== undefined ? { wideScale: coverScale(wide) } : {}),
  };
}
