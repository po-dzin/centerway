"use client";

import type { WheelEvent } from "react";

import { CROP_SCALE_MAX, CROP_SCALE_MIN, CROP_SCALE_STEP, clampCropScale } from "@/lib/media/imageCrop";

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
 * The wrapper takes its classes from the caller because the two editors live in
 * different CSS modules; everything about how the control BEHAVES lives here.
 */
export function CropZoom({
  value,
  onChange,
  classes,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  classes: { row: string; input: string; value: string };
  label: string;
}) {
  return (
    <label className={classes.row}>
      <span className={classes.value} aria-hidden="true">
        {value.toFixed(2).replace(/0$/, "").replace(/\.$/, "")}×
      </span>
      <input
        className={classes.input}
        type="range"
        min={CROP_SCALE_MIN}
        max={CROP_SCALE_MAX}
        step={CROP_SCALE_STEP}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(clampCropScale(Number(event.target.value)))}
      />
    </label>
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
