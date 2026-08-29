/**
 * CenterWay LMS core — per-course look.
 *
 * PURE TS. No DOM, no React, no Next, no npm deps.
 *
 * A theme here is a CHOICE FROM A LIST, never a set of values. An author picks
 * a gamma, a heading voice and a reading density; they cannot pick a hex, a
 * font file or a pixel size. That is the whole design: the course stays inside
 * the platform's design system — same material, same spacing scale, same
 * contrast guarantees — while still being able to look like its own thing.
 *
 * The alternative (free colour and font fields) was rejected for a concrete
 * reason, not taste: every value an author types is a value nothing checked
 * against `guard:contrast`, and an author picking their own green on their own
 * cream is exactly how a course ends up with body text at 3.1:1 that no gate
 * ever sees. A closed list is a list whose every member was measured once.
 *
 * Values map onto the token PACKS in `data/design-tokens/cw.tokens.json`
 * (`layers.packs.*`), which re-point the same `--cw-sem-*` role names. Because
 * only values move and never names, no renderer changes when a palette does.
 */

import { assert, isRecord } from "./inline";

/**
 * The gammas an author may choose. Five, and every one of them already existed.
 *
 * `default` is the platform brand sheet — warm orange over deep green on cream.
 * The other four are the distinct gammas the system already owns: the deep
 * green the way21 and dosha landings share, the lighter warm one reset-day
 * runs on its own canvas, the leaf green of herbs, and the mineral pack.
 *
 * There is no `dosha` and no `consult` entry, and their absence is the rule
 * working. Dosha runs the SAME route green as way21 and consult runs the base
 * one, so listing them would put two names on one gamma — an author choosing
 * between two identical swatches learns that the control does nothing.
 *
 * The greens are the landings' own values, deepened where a course needed them
 * to clear body AA on the reading surface (reset-day 4.61, herbs 4.58 against
 * `calm-surface`). That deepening is the platform's own documented practice,
 * not a new liberty: the brand sheet's `#588768` was moved to `#456b58` for
 * exactly the same reason.
 */
export const COURSE_PALETTES = ["default", "way21", "reset-day", "herbs", "mineral"] as const;

export type CoursePalette = (typeof COURSE_PALETTES)[number];

/**
 * Which typeface carries headings.
 *
 * Two, because there are two honest answers. `editorial` is the serif the
 * platform uses for anything that reads as a document; `ui` is the sans, which
 * a dense practical protocol (checklists, timings, tables) wants instead. A
 * third would be a font, and fonts are a loading budget, not a preference.
 */
export const COURSE_HEADING_FONTS = ["editorial", "ui"] as const;
export type CourseHeadingFont = (typeof COURSE_HEADING_FONTS)[number];

/**
 * Reading density — the type scale and the rhythm between blocks.
 *
 * Named for what it does to the reader, not for a number, because the number is
 * the design system's to choose. `compact` is a reference table someone scans;
 * `generous` is a long essay someone reads on a phone in the evening.
 */
export const COURSE_TYPE_SCALES = ["compact", "regular", "generous"] as const;
export type CourseTypeScale = (typeof COURSE_TYPE_SCALES)[number];

export type CourseTheme = {
  palette?: CoursePalette;
  headingFont?: CourseHeadingFont;
  scale?: CourseTypeScale;
};

export const DEFAULT_COURSE_THEME: Required<CourseTheme> = {
  palette: "default",
  headingFont: "editorial",
  scale: "regular",
};

export function validateCourseTheme(input: unknown, path: string): asserts input is CourseTheme {
  assert(isRecord(input), `lms_course_invalid_theme:${path}`);
  if (input.palette !== undefined) {
    assert(
      (COURSE_PALETTES as readonly string[]).includes(input.palette as string),
      `lms_course_unknown_palette:${path}`
    );
  }
  if (input.headingFont !== undefined) {
    assert(
      (COURSE_HEADING_FONTS as readonly string[]).includes(input.headingFont as string),
      `lms_course_unknown_heading_font:${path}`
    );
  }
  if (input.scale !== undefined) {
    assert(
      (COURSE_TYPE_SCALES as readonly string[]).includes(input.scale as string),
      `lms_course_unknown_scale:${path}`
    );
  }
}

/**
 * The DOM attributes that put a course's look on a subtree.
 *
 * Returned as data rather than applied, so the web renderer, the builder's
 * preview and a future native renderer all read the same decision instead of
 * each inventing how a palette becomes a style.
 *
 * The default palette emits NO attribute at all. A `data-cw-pack="default"`
 * would be a scope that re-declares the values already inherited — harmless
 * until someone nests one course preview inside another surface and the inner
 * scope pins a palette the outer one meant to change.
 */
export function courseThemeAttributes(theme: CourseTheme | undefined): Record<string, string> {
  const resolved = { ...DEFAULT_COURSE_THEME, ...(theme ?? {}) };
  const attributes: Record<string, string> = {};
  if (resolved.palette !== "default") attributes["data-cw-pack"] = resolved.palette;
  if (resolved.headingFont !== DEFAULT_COURSE_THEME.headingFont) {
    attributes["data-cw-course-font"] = resolved.headingFont;
  }
  if (resolved.scale !== DEFAULT_COURSE_THEME.scale) attributes["data-cw-course-scale"] = resolved.scale;
  return attributes;
}
