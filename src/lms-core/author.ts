/**
 * CenterWay LMS core — the author, as a thing with a page of their own.
 *
 * PURE TS. No DOM, no React, no Next, no npm deps.
 *
 * WHY THIS IS NOT FIVE FIELDS ON `Course`. A biography, a portrait and a list
 * of credentials do not change between one person's courses; only the sentence
 * about why they wrote a particular one does (`Course.authorNote`). Keeping the
 * profile here means an author edits their bio once, and "everything by this
 * person" is a join rather than a comparison of names.
 */

import { assert, isNonEmptyString, isRecord } from "./inline";

export type Author = {
  id: string;
  /**
   * The profile page's address. Human-written and stable, never derived from
   * `name` — people change how their name is spelled, and a URL that followed
   * would break every link that ever pointed at them.
   */
  slug: string;
  name: string;
  /** What they are to the platform — "Засновник центру CenterWay". One line. */
  role?: string;
  bio?: string;
  /**
   * The author in their own voice, rendered as a quotation. Stored apart from
   * `bio` rather than as a paragraph inside it, because the two are set in
   * different type and one of them carries quote marks.
   */
  quote?: string;
  /** Short verifiable statements: degrees, years, titles. Never paragraphs. */
  credentials?: string[];
  photo?: {
    src: string;
    /** Mandatory wherever an image is — a11y is a release gate in this repo. */
    alt: string;
  };
  /** Decorative backdrop for the public author showcase. */
  background?: { src: string };
  /**
   * Whether strangers may reach the profile page. Absent means no.
   *
   * Independent of whether the author's COURSES are listed, the same way
   * `Course.visibility` is independent of `Course.status`: a person can sell a
   * listed course without publishing a page about themselves.
   */
  listed?: boolean;
};

export function validateAuthor(input: unknown, path = "author"): asserts input is Author {
  assert(isRecord(input), `lms_author_invalid_shape:${path}`);
  assert(isNonEmptyString(input.id), `lms_author_missing_id:${path}`);
  assert(isNonEmptyString(input.slug), `lms_author_missing_slug:${path}`);
  assert(isNonEmptyString(input.name), `lms_author_missing_name:${path}`);

  for (const textKey of ["role", "bio", "quote"] as const) {
    const value = input[textKey];
    if (value === undefined) continue;
    assert(isNonEmptyString(value), `lms_author_invalid_${textKey}:${path}`);
  }

  if (input.credentials !== undefined) {
    // Empty is rejected rather than tolerated, same as `Course.results`: the way
    // to say "none" is to leave the field out, not to store a heading over
    // nothing.
    assert(
      Array.isArray(input.credentials) &&
        input.credentials.length > 0 &&
        input.credentials.every(isNonEmptyString),
      `lms_author_invalid_credentials:${path}`
    );
  }

  if (input.photo !== undefined) {
    assert(isRecord(input.photo), `lms_author_invalid_photo:${path}`);
    assert(isNonEmptyString(input.photo.src), `lms_author_photo_missing_src:${path}`);
    assert(isNonEmptyString(input.photo.alt), `lms_author_photo_missing_alt:${path}`);
  }

  if (input.background !== undefined) {
    assert(isRecord(input.background), `lms_author_invalid_background:${path}`);
    assert(isNonEmptyString(input.background.src), `lms_author_background_missing_src:${path}`);
  }

  if (input.listed !== undefined) {
    assert(typeof input.listed === "boolean", `lms_author_invalid_listed:${path}`);
  }
}
