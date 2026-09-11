"use client";

import type { WheelEvent } from "react";

import { CROP_SCALE_STEP, clampCropScale } from "@/lib/media/imageCrop";

/* THE SLIDER IS GONE (2026-09-11) — the crop window is resized by its own four
   corners now, and a second control for one number is a second answer. What
   survives in this module is the KEYBOARD and WHEEL path to the same number,
   which the slider never owned: `cropKeyZoom` for `+`/`-` and `cropWheelZoom`
   for Ctrl and a wheel. The component itself, and its stylesheet, went with the
   control it drew. */

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
