import type { PlatformOfferSurfaceType } from "@/lib/platform/content";

/**
 * What this page actually needs, declared instead of inferred.
 *
 * It used to be typed as `(typeof programs)[number]` — one of the six literals
 * in content.ts — which made "an offer page" and "an offer hard-coded in
 * TypeScript" the same thing. A course out of the builder is an offer too, and
 * it satisfies exactly these ten fields. The six still pass unchanged: this is
 * a narrowing of what is asked for, not a change to what they carry.
 */
export type OfferSurface = {
  slug: string;
  title: string;
  fullTitle: string;
  /**
   * The line between the name and the tagline: what kind of thing this is.
   *
   * Optional, and empty for most offers. It exists because a title written in
   * the builder often carries two jobs in one string — «Розвантажувальний день
   * — практикум з умовного голодування» — and the half after the dash is not
   * noise, it just cannot be part of a name. The name is the h1, this is under
   * it, the tagline is under that. See `offerSubtitle`.
   */
  subtitle?: string;
  /**
   * The author's own line ABOVE the name, when they wrote one.
   *
   * The mirror of `subtitle`, and a different thing from `tag`: `tag` says what
   * kind of object this is and is the system's word, this is the author's, and
   * it is the one line of the three they write that had nowhere to go. It has
   * reached the catalogue card since the field existed — `StorefrontCard.
   * pretitle`, in the card's eyebrow — while the offer page, the surface with
   * the most room for it, printed the card's version of the name and none of
   * its frame.
   */
  pretitle?: string;
  tag: string;
  duration: string;
  description: string;
  longDescription: string;
  results: readonly string[];
  surfaceType: PlatformOfferSurfaceType;
  artwork?: { desktop: string; desktopPosition?: string; mobilePosition?: string };
  /**
   * The offer surface proper (2026-08-26). Optional to a fault, and that is the
   * point: these are the things the six hand-written pages said in prose only a
   * developer could edit, and a course out of the builder says exactly as many
   * of them as its author has filled in. A page prints what it has and stays
   * quiet about the rest — never a heading over an empty list.
   */
  audience?: readonly string[];
  format?: readonly string[];
  /** The access promise printed beside the price — "доступ назавжди". */
  accessNote?: string;
  /** Why this author for this course. One sentence; the profile is joined separately. */
  authorNote?: string;
};
