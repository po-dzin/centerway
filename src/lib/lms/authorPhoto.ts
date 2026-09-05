import type { CSSProperties } from "react";

import { cropStyle, type ImageCrop } from "@/lib/media/imageCrop";
import type { Author } from "@/lms-core";

/**
 * The focal point an author's photo falls back to when nobody has dragged the
 * picker — chosen to match the object-position every card and avatar drew
 * before the crop editor existed (`AuthorProfileFold`), so a profile nobody
 * has re-cropped renders exactly as it always did.
 */
export const AUTHOR_CARD_CROP_DEFAULT = { x: 50, y: 22 };
export const AUTHOR_AVATAR_CROP_DEFAULT = { x: 50, y: 50 };

/** The backdrop band's default — dead centre, which is what it drew before it could be aimed. */
export const AUTHOR_BANNER_CROP_DEFAULT = { x: 50, y: 50 };

/** The card frame's crop, in the shape `cropStyle` reads. */
export function authorCardCrop(photo: Author["photo"] | undefined): ImageCrop {
  return { x: photo?.cropX, y: photo?.cropY, scale: photo?.cropScale };
}

/** The round avatar's crop — the author's own page and a course's byline. */
export function authorAvatarCrop(photo: Author["photo"] | undefined): ImageCrop {
  return { x: photo?.avatarCropX, y: photo?.avatarCropY, scale: photo?.avatarCropScale };
}

/**
 * The style the card's `<img>` carries — `AuthorCard`, everywhere it renders.
 *
 * A STYLE OBJECT, NOT A POSITION STRING. These used to return the
 * `object-position` alone, and a caller spread it into `style` itself. Zoom
 * adds a `transform` and a `transform-origin` that must agree with that
 * position or the frame drifts off the face it was aimed at, so what a caller
 * gets is the whole framing or none of it — there is no way left to apply half.
 */
export function authorCardCropStyle(photo: Author["photo"] | undefined): CSSProperties {
  return cropStyle(authorCardCrop(photo), AUTHOR_CARD_CROP_DEFAULT);
}

/** The style the round avatar's `<img>` carries. */
export function authorAvatarCropStyle(photo: Author["photo"] | undefined): CSSProperties {
  return cropStyle(authorAvatarCrop(photo), AUTHOR_AVATAR_CROP_DEFAULT);
}
