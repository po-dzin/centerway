"use client";

/**
 * A profile's pictures, opened in the platform's one viewer (2026-10-23).
 *
 * On an author's page the portrait is the way in: pressing it shows the
 * portrait at its own proportions and, when the author has one, the cover
 * behind it as the second picture — the same `PhotoViewer` the feed and the
 * cabinet's own face open, not a second lightbox. The page around it stays a
 * server component; only this wrapper is client code.
 *
 * selection_family: contour (the focus ring on the portrait).
 */

import { useState, type ReactNode } from "react";

import { PhotoViewer, type ViewerPhoto } from "@/components/platform/PhotoViewer";
import styles from "./ProfilePhotos.module.css";

export function ProfilePhotos({
  photos,
  label,
  viewerLabel,
  children,
}: {
  /** First is what the trigger shows; the rest follow it in the viewer. */
  photos: ViewerPhoto[];
  /** The trigger's name for a screen reader, e.g. «Фото: Центр П.». */
  label: string;
  viewerLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (photos.length === 0) return <>{children}</>;
  return (
    <>
      <button type="button" className={styles.open} aria-label={label} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open ? <PhotoViewer photos={photos} start={0} label={viewerLabel} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
