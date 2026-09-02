import type { Author } from "@/lms-core";

/**
 * The focal point an author's photo falls back to when nobody has dragged the
 * picker — chosen to match the object-position every card and avatar drew
 * before the crop editor existed (`AuthorProfileFold`), so a profile nobody
 * has re-cropped renders exactly as it always did.
 */
export const AUTHOR_CARD_CROP_DEFAULT = { x: 50, y: 22 };
export const AUTHOR_AVATAR_CROP_DEFAULT = { x: 50, y: 50 };

/** CSS `object-position` for the card frame — `AuthorCard`, everywhere it renders. */
export function authorCardCropPosition(photo: Author["photo"] | undefined): string {
  return `${photo?.cropX ?? AUTHOR_CARD_CROP_DEFAULT.x}% ${photo?.cropY ?? AUTHOR_CARD_CROP_DEFAULT.y}%`;
}

/** CSS `object-position` for the round avatar frame — the author's own page and a course's byline. */
export function authorAvatarCropPosition(photo: Author["photo"] | undefined): string {
  return `${photo?.avatarCropX ?? AUTHOR_AVATAR_CROP_DEFAULT.x}% ${photo?.avatarCropY ?? AUTHOR_AVATAR_CROP_DEFAULT.y}%`;
}
