import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { isPrepareFailure, prepareMedia, MAX_INPUT_BYTES } from "./mediaPipeline";

/** A noisy photograph-shaped source: flat colour would compress to nothing and prove nothing. */
async function photo(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
      noise: { type: "gaussian", mean: 128, sigma: 60 },
    },
  })
    .jpeg({ quality: 95 })
    .toBuffer();
}

describe("prepareMedia", () => {
  // Decoding and re-encoding real megapixels is seconds, not the default five
  // milliseconds-per-assertion this suite is otherwise made of.
  it("stores a phone-sized photograph as two renditions, both far smaller than the original", { timeout: 30_000 }, async () => {
    const source = await photo(4032, 3024);
    const result = await prepareMedia(source, "image/jpeg");
    if (isPrepareFailure(result)) throw new Error(result.error);

    expect(result.renditions.map((r) => r.name)).toEqual(["1600.webp", "640.webp"]);
    expect(result.width).toBe(1600);
    expect(result.height).toBe(1200);
    expect(result.renditions[0].bytes.byteLength).toBeLessThan(source.byteLength);
  });

  it("does not enlarge a small original, and does not write a second rendition for it", async () => {
    const result = await prepareMedia(await photo(600, 400), "image/png");
    if (isPrepareFailure(result)) throw new Error(result.error);

    expect(result.renditions).toHaveLength(1);
    expect(result.width).toBe(600);
  });

  it("keeps the upright orientation an EXIF tag asked for", { timeout: 30_000 }, async () => {
    // orientation 6 means "rotate 90° clockwise to display": a 1200×800 file
    // that is really an 800×1200 portrait.
    const source = await sharp(await photo(1200, 800))
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    const result = await prepareMedia(source, "image/jpeg");
    if (isPrepareFailure(result)) throw new Error(result.error);
    expect(result.height).toBeGreaterThan(result.width);
  });

  it("refuses bytes that are not an image at all", async () => {
    const result = await prepareMedia(Buffer.from("not a picture"), "image/png");
    expect(result).toEqual({ error: "media_not_an_image" });
  });

  it("refuses an input past the ceiling before doing any work", async () => {
    const result = await prepareMedia(Buffer.alloc(MAX_INPUT_BYTES + 1), "image/jpeg");
    expect(isPrepareFailure(result) && result.error.startsWith("media_too_large:")).toBe(true);
  });

  it("passes an animation through rather than flattening it to one frame", async () => {
    const frames = await sharp({
      create: { width: 120, height: 60, channels: 4, background: { r: 200, g: 40, b: 40, alpha: 1 } },
    })
      .gif()
      .toBuffer();

    const result = await prepareMedia(frames, "image/gif");
    if (isPrepareFailure(result)) throw new Error(result.error);
    // A single-frame GIF is not an animation, so it takes the normal path.
    expect(result.verbatim).toBe(false);
  });
});
