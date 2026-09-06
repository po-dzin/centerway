import type { ReactNode } from "react";

import { authorAvatarCropStyle } from "@/lib/lms/authorPhoto";
import type { Author } from "@/lms-core";
import styles from "./AuthorPortrait.module.css";

/**
 * A person's face, wherever the product shows one.
 *
 * WHY IT EXISTS. The markup was identical in three files and the CSS in five —
 * a frame that clips, a picture carrying the author's own crop, and something
 * to draw when there is no picture. Only the crop was shared. So the three
 * places that show an author's face each owned a size, a radius, an
 * `overflow`, an `object-fit` and an empty state, and the first time the shape
 * changed (portraits left the circle on 2026-09-06) it took four hand-edits and
 * still left the crop editor's caption saying «Кругла аватарка».
 *
 * A PLAIN `<img>`, DELIBERATELY. Author photographs are public Supabase Storage
 * URLs written from the cabinet, so they are not in `next/image`'s remote
 * allow-list at build time, and one of the three call sites was already using a
 * bare tag for exactly that reason. Making the optimiser the default here would
 * mean it works on the two pages whose photo happens to be committed and fails
 * on every profile an author uploads.
 *
 * THE CROP COMES FROM THE AUTHOR, always: `authorAvatarCropStyle` is the same
 * framing the cabinet's editor aims, so a face that was centred there is
 * centred on the offer page, on the author's page and in the workshop preview.
 * The one surface that used to render the raw centre was the workshop, and that
 * is precisely the bug this shape prevents from coming back.
 */
export function AuthorPortrait({
  photo,
  size = "md",
  fallback,
  className,
}: {
  photo: Author["photo"] | null | undefined;
  /** `sm` a row's preview · `md` a byline · `lg` the author's own page. */
  size?: "sm" | "md" | "lg";
  /**
   * What to draw with no photograph — an initial where a name is beside it, a
   * glyph where none is. Omitted, the portrait renders nothing at all: a page
   * that would rather show no face than an empty box says so by leaving this
   * out.
   */
  fallback?: ReactNode;
  className?: string;
}) {
  const box = `${styles.frame} ${styles[size]}${className ? ` ${className}` : ""}`;

  if (!photo) {
    if (!fallback) return null;
    return (
      <span className={`${box} ${styles.fallback}`} aria-hidden="true">
        {fallback}
      </span>
    );
  }

  return (
    <span className={box}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.image}
        src={photo.src}
        alt={photo.alt}
        loading="lazy"
        decoding="async"
        style={authorAvatarCropStyle(photo)}
      />
    </span>
  );
}
