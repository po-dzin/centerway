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

export type AuthorProfileBlock = {
  id: string;
  kind: "text" | "list" | "timeline";
  label?: string;
  title: string;
  body?: string;
  items?: string[];
};

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
  /** Six concise public facts; the first three are the card bullets. */
  facts?: string[];
  /** Ordered, author-owned sections for story, methods, education and path. */
  profileBlocks?: AuthorProfileBlock[];
  experienceBadge?: string;
  achievementBadge?: string;
  consultation?: {
    enabled: boolean;
    title?: string;
    summary?: string;
    points?: string[];
    contactUrl?: string;
  };
  photo?: {
    src: string;
    /** Mandatory wherever an image is — a11y is a release gate in this repo. */
    alt: string;
    /**
     * Focal point for the card frame — the shape `AuthorCard` fills the whole
     * plate with (home, `/consult`, `/experts`) — as a percentage of the
     * image, 0–100. Absent keeps the platform's own default rather than
     * freezing "centre" into every profile that predates this field.
     */
    cropX?: number;
    cropY?: number;
    /**
     * Focal point for the round avatar frame — the author's own page and a
     * course's byline. Absent means "follow the card's own point", the same
     * relationship `Course.cover.wideCropY` has to its landscape crop: most
     * portraits read fine cropped once, and a second point is there for the
     * ones that do not.
     */
    avatarCropX?: number;
    avatarCropY?: number;
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

/**
 * Shared profile readiness for the Builder and any future author tools.
 *
 * These are the ten author-owned content groups that make the public profile
 * and its cards useful. Publishing, consultation availability and the
 * decorative background are choices, so they do not lower the score.
 */
export function authorProfileCompletion(author: Author): {
  completed: number;
  total: number;
  percent: number;
} {
  const checks = [
    Boolean(author.name.trim()),
    Boolean(author.photo?.src && author.photo.alt.trim()),
    Boolean(author.role?.trim()),
    Boolean(author.bio?.trim()),
    Boolean(author.quote?.trim()),
    Boolean(author.credentials?.some((item) => item.trim())),
    (author.facts?.filter((item) => item.trim()).length ?? 0) === 6,
    Boolean(author.profileBlocks?.length),
    Boolean(author.experienceBadge?.trim()),
    Boolean(author.achievementBadge?.trim()),
  ];
  const completed = checks.filter(Boolean).length;
  return { completed, total: checks.length, percent: Math.round((completed / checks.length) * 100) };
}

export function validateAuthor(input: unknown, path = "author"): asserts input is Author {
  assert(isRecord(input), `lms_author_invalid_shape:${path}`);
  assert(isNonEmptyString(input.id), `lms_author_missing_id:${path}`);
  assert(isNonEmptyString(input.slug), `lms_author_missing_slug:${path}`);
  assert(isNonEmptyString(input.name), `lms_author_missing_name:${path}`);

  for (const textKey of ["role", "bio", "quote", "experienceBadge", "achievementBadge"] as const) {
    const value = input[textKey];
    if (value === undefined) continue;
    assert(isNonEmptyString(value), `lms_author_invalid_${textKey}:${path}`);
  }

  if (input.facts !== undefined) {
    assert(Array.isArray(input.facts) && input.facts.length <= 6 && input.facts.every(isNonEmptyString), `lms_author_invalid_facts:${path}`);
  }
  if (input.profileBlocks !== undefined) {
    assert(Array.isArray(input.profileBlocks) && input.profileBlocks.length <= 12, `lms_author_invalid_profile_blocks:${path}`);
    for (const [index, block] of input.profileBlocks.entries()) {
      const blockPath = `${path}.profileBlocks.${index}`;
      assert(isRecord(block), `lms_author_invalid_profile_block:${blockPath}`);
      assert(isNonEmptyString(block.id), `lms_author_profile_block_missing_id:${blockPath}`);
      assert(["text", "list", "timeline"].includes(String(block.kind)), `lms_author_profile_block_invalid_kind:${blockPath}`);
      assert(isNonEmptyString(block.title), `lms_author_profile_block_missing_title:${blockPath}`);
      if (block.label !== undefined) assert(isNonEmptyString(block.label), `lms_author_profile_block_invalid_label:${blockPath}`);
      if (block.body !== undefined) assert(isNonEmptyString(block.body), `lms_author_profile_block_invalid_body:${blockPath}`);
      if (block.items !== undefined) {
        assert(Array.isArray(block.items) && block.items.length <= 30 && block.items.every(isNonEmptyString), `lms_author_profile_block_invalid_items:${blockPath}`);
      }
      assert(block.body !== undefined || (Array.isArray(block.items) && block.items.length > 0), `lms_author_profile_block_empty:${blockPath}`);
    }
  }
  if (input.consultation !== undefined) {
    assert(isRecord(input.consultation) && typeof input.consultation.enabled === "boolean", `lms_author_invalid_consultation:${path}`);
    for (const key of ["title", "summary", "contactUrl"] as const) {
      if (input.consultation[key] !== undefined) assert(isNonEmptyString(input.consultation[key]), `lms_author_invalid_consultation_${key}:${path}`);
    }
    if (input.consultation.points !== undefined) assert(Array.isArray(input.consultation.points) && input.consultation.points.length <= 3 && input.consultation.points.every(isNonEmptyString), `lms_author_invalid_consultation_points:${path}`);
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
    for (const cropKey of ["cropX", "cropY", "avatarCropX", "avatarCropY"] as const) {
      const value = input.photo[cropKey];
      if (value === undefined) continue;
      assert(typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100, `lms_author_invalid_photo_${cropKey}:${path}`);
    }
  }

  if (input.background !== undefined) {
    assert(isRecord(input.background), `lms_author_invalid_background:${path}`);
    assert(isNonEmptyString(input.background.src), `lms_author_background_missing_src:${path}`);
  }

  if (input.listed !== undefined) {
    assert(typeof input.listed === "boolean", `lms_author_invalid_listed:${path}`);
  }
}
