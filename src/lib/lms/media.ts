/**
 * Reading an uploaded image's other sizes back out of its address.
 *
 * THE PROBLEM. A `src` is one string, stored on the course, and by the time a
 * card renders it there is nothing else: no row of renditions, no width, no
 * record of who made it. It may be one of ours, or `/cw/…` shipped in the
 * repo, or a URL the author pasted from someone else's CDN — and only the first
 * kind has a smaller sibling to offer.
 *
 * THE ANSWER IS THE PATH ITSELF. The upload route writes a folder per image and
 * names each rendition by its width, so `…/<uuid>/1600.webp` says out loud that
 * `…/<uuid>/640.webp` is next to it. That makes the convention self-describing:
 * an address either matches it — our bucket, our folder shape — or it does not,
 * and a pasted link cannot accidentally claim a rendition that was never made.
 * Images uploaded before 2026-08-28 sit at a flat `<uuid>.webp` and simply do
 * not match, which is the correct answer for them.
 *
 * WHY NOT `next/image`. It would need every host an author can paste configured
 * before it renders at all, and the transform would run on the platform's
 * quota for images we already sized ourselves. The renditions exist; this just
 * tells the browser they do.
 */

/** The one prefix a public object of ours can have. */
const BUCKET_MARK = "/storage/v1/object/public/course-media/";

/** Widths the route writes, largest first. Must match `RENDITIONS`. */
const WIDTHS = [1600, 640];

export type MediaSources = {
  src: string;
  /** Absent unless the address is a rendition folder of ours. */
  srcSet?: string;
};

/**
 * `sizes` is a promise about layout, so it belongs to whoever does the layout —
 * these are the three shapes this product actually has.
 */
export const MEDIA_SIZES = {
  /** A cover in a grid of cards: roughly a third of a wide screen, all of a phone. */
  card: "(min-width: 900px) 33vw, (min-width: 560px) 50vw, 100vw",
  /** A figure inside the reading column, which the column itself caps. */
  figure: "(min-width: 900px) 720px, 100vw",
  /** A cover shown alone — an offer hero, the builder's own framing tool. */
  full: "100vw",
} as const;

export function mediaSources(src: string): MediaSources {
  const mark = src.indexOf(BUCKET_MARK);
  if (mark < 0) return { src };

  const slash = src.lastIndexOf("/");
  const file = src.slice(slash + 1);
  const widest = WIDTHS[0];
  if (file !== `${widest}.webp`) return { src };

  const folder = src.slice(0, slash);
  return {
    src,
    srcSet: WIDTHS.map((width) => `${folder}/${width}.webp ${width}w`).join(", "),
  };
}
