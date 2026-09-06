import { describe, expect, it } from "vitest";

import { CROP_SCALE_MAX, clampCropScale, cropBackgroundStyle, cropIsZoomed, cropPan, cropStyle } from "./imageCrop";
import { shrinkForUpload } from "./shrinkForUpload";
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

describe("the backdrop band", () => {
  it("keeps `cover` and scales the layer, never `background-size`", () => {
    // A percentage `background-size` abandons the cover fit and uncovers an
    // edge as soon as the photo's ratio differs from the band's 6:1.
    expect(cropBackgroundStyle({ x: 50, y: 20 }, { x: 50, y: 50 })).toEqual({ backgroundPosition: "50% 20%" });
    expect(cropBackgroundStyle({ x: 50, y: 20, scale: 1.8 }, { x: 50, y: 50 })).toEqual({
      backgroundPosition: "50% 20%",
      transformOrigin: "50% 20%",
      transform: "scale(1.8)",
    });
  });
});

describe("shrinkForUpload", () => {
  it("hands the file straight through where it cannot decode one", async () => {
    // No `createImageBitmap` here, which is also the real fallback path in an
    // engine that cannot read what the author picked: the route answers, not us.
    const file = new File([new Uint8Array(32)], "photo.jpg", { type: "image/jpeg" });
    expect(await shrinkForUpload(file)).toBe(file);
  });

  it("never touches a GIF — a canvas would return its first frame and call that the picture", async () => {
    const gif = new File([new Uint8Array(4 * 1024 * 1024)], "loop.gif", { type: "image/gif" });
    expect(await shrinkForUpload(gif)).toBe(gif);
  });
});

describe("cropPan", () => {
  /* A 1000×500 photograph in a 200×200 frame: `cover` scales it to 400×200, so
     200 pixels of width are hidden and its height is exactly covered. One
     dragged pixel is therefore half a per cent of the crop across, and nothing
     at all down. */
  const wide = { width: 1000, height: 500 };
  const tall = { width: 500, height: 1000 };
  const frame = { width: 200, height: 200 };

  it("moves the picture with the hand, not against it", () => {
    // Dragging right reveals what is to the LEFT, which is a smaller x.
    expect(cropPan({ x: 50, y: 50 }, { dx: 20, dy: 0 }, frame, wide, 1)).toEqual({ x: 40, y: 50 });
    expect(cropPan({ x: 50, y: 50 }, { dx: 0, dy: -20 }, frame, tall, 1)).toEqual({ x: 50, y: 60 });
  });

  it("converts against what is hidden, so a zoomed frame moves less per pixel", () => {
    // At 2× the same photo covers 800×400 and hides 600 across, so the same
    // 20 pixels of hand are a third of the crop they were at 1×.
    expect(cropPan({ x: 50, y: 50 }, { dx: 20, dy: 0 }, frame, wide, 2)).toEqual({ x: 47, y: 50 });
  });

  it("cannot move an axis that hides nothing", () => {
    // The wide photo's height is exactly covered at 1×: a vertical drag has
    // nothing to reveal, and must not pretend otherwise.
    expect(cropPan({ x: 50, y: 50 }, { dx: 0, dy: 60 }, frame, wide, 1).y).toBe(50);
  });

  it("clamps at the edges rather than running past the picture", () => {
    expect(cropPan({ x: 10, y: 50 }, { dx: 100, dy: 0 }, frame, wide, 1).x).toBe(0);
  });

  it("falls back to the frame while the image is still decoding", () => {
    // `naturalWidth` is 0 until the file decodes; dividing by the overflow
    // would divide by nothing, so the frame's own width is the gain.
    expect(cropPan({ x: 50, y: 50 }, { dx: 50, dy: 0 }, frame, { width: 0, height: 0 }, 1)).toEqual({
      x: 25,
      y: 50,
    });
  });
});
