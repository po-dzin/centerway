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

import { BRAND_LOCALE } from "@/lib/brand/identity";

export type PageMetadataInput = {
  /** Without the brand suffix — the layout's template appends it. */
  title: string;
  description: string;
  /** Site-relative, canonical form. Omit for a page that must not claim one. */
  path?: string;
  /** Page-specific share image; the layout's brand cover is used otherwise. */
  image?: string;
  /** Private surfaces: out of the index and out of the sitemap. */
  noindex?: boolean;
  /**
   * Skip the brand suffix. For the one page whose title already opens with the
   * name — appending it a second time would read "CenterWay — … — CenterWay".
   */
  absoluteTitle?: boolean;
};

export function pageMetadata(input: PageMetadataInput): Metadata {
  const { title, description, path, image, noindex, absoluteTitle } = input;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    ...(path ? { alternates: { canonical: path } } : {}),
    openGraph: {
      title,
      description,
      type: "website",
      locale: BRAND_LOCALE,
      ...(path ? { url: path } : {}),
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
