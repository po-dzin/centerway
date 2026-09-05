import { describe, expect, it } from "vitest";

import { CROP_SCALE_MAX, clampCropScale, cropIsZoomed, cropStyle } from "./imageCrop";
import { authorAvatarCropStyle, authorCardCropStyle } from "@/lib/lms/authorPhoto";
import { coverArtworkFraming, coverCardStyle } from "@/lib/lms/courseCover";

describe("cropStyle", () => {
  it("writes no transform at all when nothing is zoomed", () => {
    // The point of the whole design: an unzoomed photo must not pay for a
    // compositing layer, so `scale(1)` is never emitted.
    expect(cropStyle({ x: 40, y: 10 }, { x: 50, y: 50 })).toEqual({ objectPosition: "40% 10%" });
    expect(cropStyle({ x: 40, y: 10, scale: 1 }, { x: 50, y: 50 })).toEqual({ objectPosition: "40% 10%" });
  });

  it("scales about the focal point, so the point the author aimed at stays put", () => {
    expect(cropStyle({ x: 30, y: 80, scale: 2.5 }, { x: 50, y: 50 })).toEqual({
      objectPosition: "30% 80%",
      transformOrigin: "30% 80%",
      transform: "scale(2.5)",
    });
  });

  it("falls back per axis, not per crop", () => {
    expect(cropStyle({ y: 22 }, { x: 50, y: 50 })).toEqual({ objectPosition: "50% 22%" });
  });

  it("clamps the scale to the range the sliders offer", () => {
    expect(clampCropScale(0.2)).toBe(1);
    expect(clampCropScale(99)).toBe(CROP_SCALE_MAX);
    expect(cropIsZoomed(1)).toBe(false);
    expect(cropIsZoomed(undefined)).toBe(false);
    expect(cropIsZoomed(1.05)).toBe(true);
  });
});

describe("author photo frames", () => {
  it("keeps the pre-crop defaults for a profile nobody has re-cropped", () => {
    expect(authorCardCropStyle(undefined)).toEqual({ objectPosition: "50% 22%" });
    expect(authorAvatarCropStyle(undefined)).toEqual({ objectPosition: "50% 50%" });
  });

  it("gives the card and the avatar their own zoom", () => {
    const photo = { src: "/a.jpg", alt: "a", cropScale: 1.4, avatarCropX: 60, avatarCropScale: 2 };
    expect(authorCardCropStyle(photo)).toEqual({
      objectPosition: "50% 22%",
      transformOrigin: "50% 22%",
      transform: "scale(1.4)",
    });
    expect(authorAvatarCropStyle(photo)).toEqual({
      objectPosition: "60% 50%",
      transformOrigin: "60% 50%",
      transform: "scale(2)",
    });
  });
});

describe("course cover frames", () => {
  it("lets the portrait and wide frames inherit the landscape zoom", () => {
    const framing = coverArtworkFraming({ src: "/c.jpg", alt: "c", cropX: 40, cropY: 30, cropScale: 1.5 });
    expect(framing.desktopScale).toBe(1.5);
    expect(framing.mobileScale).toBe(1.5);
    // No wide focus and no wide zoom of its own: the hero contract already
    // resolves an absent `--hero-photo-y-wide` to the desktop focus, so
    // publishing one would be saying the same thing twice.
    expect(framing.widePosition).toBeUndefined();
  });

  it("lets a frame override the landscape zoom without touching the others", () => {
    const framing = coverArtworkFraming({
      src: "/c.jpg",
      alt: "c",
      cropScale: 1.5,
      wideCropY: 80,
      wideCropScale: 2.2,
      mobileCropScale: 1,
    });
    expect(framing.wideScale).toBe(2.2);
    expect(framing.widePosition).toBe("50% 80%");
    // 1× is not a zoom, so the phone publishes nothing and pays for nothing.
    expect(framing.mobileScale).toBeUndefined();
  });

  it("draws an uncropped cover exactly as it did before the zoom existed", () => {
    expect(coverCardStyle({ src: "/c.jpg", alt: "c" })).toEqual({ objectPosition: "50% 50%" });
  });
});
