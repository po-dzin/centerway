"use client";

import type { PointerEvent, WheelEvent } from "react";

import { CROP_SCALE_MAX, CROP_SCALE_MIN, CROP_SCALE_STEP, clampCropScale } from "@/lib/media/imageCrop";
import styles from "./CropZoom.module.css";

/**
 * The magnification half of a crop, as one control.
 *
 * SHARED, WHERE THE FRAMES ARE NOT. The two crop editors in this product — the
 * builder's cover and the cabinet's author photo — deliberately keep their own
 * frames: one chooses among 16:9, 21:9 and 9:16, the other between a card and a
 * circle, and neither owns the other's shapes. The zoom has no such split. It
 * is one number with one range and one keyboard, and written twice it would be
 * two ranges within a release.
 *
 * IT NOW BRINGS ITS OWN SKIN (2026-09-06). The wrapper used to take three class
 * names from the caller, which meant the LOOK was written once per editor and
 * had already drifted on type size — and both copies were the browser's own
 * range control, the one organ on these editors nobody drew. See
 * CropZoom.module.css. The caller supplies a placement class and nothing else.
 */
export function CropZoom({
  value,
  onChange,
  label,
  className,
}: {
  value: number;
  onChange: (next: number) => void;
  label: string;
  /** Placement only — where this row sits under its frame. */
  className?: string;
}) {
  const progress = ((value - CROP_SCALE_MIN) / (CROP_SCALE_MAX - CROP_SCALE_MIN)) * 100;
  return (
    <div className={className ? `${styles.row} ${className}` : styles.row}>
      <span className={styles.value} aria-hidden="true">
        {value.toFixed(2).replace(/0$/, "").replace(/\.$/, "")}×
      </span>
      <input
        className={styles.input}
        style={{ "--cw-crop-zoom-progress": `${progress}%` } as Record<string, string>}
        type="range"
        min={CROP_SCALE_MIN}
        max={CROP_SCALE_MAX}
        step={CROP_SCALE_STEP}
        value={value}
        aria-label={label}
        /* The frame above owns dragging; a pointer that started on this track
           is not aiming the crop and must not be handed to it. */
        onPointerDown={(event: PointerEvent<HTMLInputElement>) => event.stopPropagation()}
        onChange={(event) => onChange(clampCropScale(Number(event.target.value)))}
      />
    </div>
  );
}

/**
 * Zoom by wheel over the frame itself, which is where a hand reaches first.
 *
 * IT DOES NOT SWALLOW THE PAGE SCROLL. A frame that ate every wheel event would
 * trap the reader inside a form six screens long. The gesture is the platform's
 * own zoom modifier — ctrl on a mouse, which is also what a trackpad pinch
 * sends — so a plain scroll past the frame still scrolls the page.
 */
export function cropWheelZoom(value: number, event: WheelEvent, onChange: (next: number) => void) {
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  onChange(clampCropScale(value - event.deltaY * 0.005));
}

/** `+` / `-` on a focused frame, the keyboard half of the same gesture. */
export function cropKeyZoom(value: number, key: string, onChange: (next: number) => void): boolean {
  if (key === "+" || key === "=") {
    onChange(clampCropScale(value + CROP_SCALE_STEP * 2));
    return true;
  }
  if (key === "-" || key === "_") {
    onChange(clampCropScale(value - CROP_SCALE_STEP * 2));
    return true;
  }
  return false;
}
