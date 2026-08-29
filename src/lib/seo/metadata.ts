/**
 * Page metadata, built the same way every time.
 *
 * WHAT WAS WRONG. Thirty `export const metadata` blocks, each assembling the
 * same four facts by hand: a title that repeated "- CenterWay" (or "|", or
 * nothing), a description in whatever voice that day had, a canonical present
 * on some pages and missing on others, and an OG title that — where it existed
 * at all — said something different from the `<title>`. A crawler reading two
 * different titles for one page believes neither.
 *
 * THE SHAPE. `pageMetadata` takes the page's own answer and derives the rest:
 * the suffix comes from the layout's title template, the canonical from the
 * path, and the OG/Twitter pair from the title and description that are already
 * there. What a page still decides for itself is the description — see
 * `describe` in the brand identity for the format it must be written in.
 */

import type { Metadata } from "next";

import { BRAND, BRAND_COVER, BRAND_LOCALE } from "@/lib/brand/identity";

export type PageMetadataInput = {
  /** Without the brand suffix — the layout's template appends it. */
  title: string;
  description: string;
  /** Site-relative, canonical form. Omit for a page that must not claim one. */
  path?: string;
  /** Page-specific share image; the brand cover is used otherwise. */
  image?: string;
  /** Alt text for a page-specific `image`. Ignored when the brand cover is used. */
  imageAlt?: string;
  /** Private surfaces: out of the index and out of the sitemap. */
  noindex?: boolean;
  /**
   * Skip the brand suffix. For the one page whose title already opens with the
   * name — appending it a second time would read "CenterWay — … — CenterWay".
   */
  absoluteTitle?: boolean;
};

/**
 * WHY THE COVER IS REPEATED HERE. Next merges metadata per top-level field, not
 * per key: a page that declares `openGraph` REPLACES the layout's `openGraph`
 * wholesale, taking `images` and `siteName` down with it. Every page built here
 * declares one, so every page was shipping a preview with no picture and no
 * site name — the layout's cover was inherited by exactly the pages that never
 * called this function. The defaults belong on this side of the merge.
 */
export function pageMetadata(input: PageMetadataInput): Metadata {
  const { title, description, path, noindex, absoluteTitle } = input;
  // The 1200×630 dimensions and the brand alt are true of `cw-og-cover.png`
  // specifically, not of an arbitrary caller-supplied image — a course cover
  // has its own aspect ratio and its own alt text (or none at all).
  const image = input.image
    ? { url: input.image, ...(input.imageAlt ? { alt: input.imageAlt } : {}) }
    : { url: BRAND_COVER, width: 1200, height: 630, alt: BRAND.name };

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    ...(path ? { alternates: { canonical: path } } : {}),
    openGraph: {
      title,
      description,
      type: "website",
      siteName: BRAND.name,
      locale: BRAND_LOCALE,
      ...(path ? { url: path } : {}),
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
