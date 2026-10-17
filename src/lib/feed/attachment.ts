/**
 * What a post's attachment card shows, from the course and lesson it points at
 * (2026-10-17). One function for both sides: the server builds the card a
 * reader receives, and the composer builds the same card as its preview, so
 * what the author sees before publishing is what the feed will draw.
 *
 * Pure, no database: both callers have already read the rows.
 */

import { feedBlockOf, feedBlockText } from "./blocks";
import { excerptOf } from "./model";
import type { FeedAttachment } from "./server";

export type AttachmentCourse = { title: string; slug: string | null; programSlug: string | null };
export type AttachmentLesson = { title: string; dayIndex: number | null; blocks: unknown };

function programHref(course: AttachmentCourse): string | null {
  return course.programSlug ? `/programs/${course.programSlug}` : null;
}

export function programAttachment(course: AttachmentCourse): FeedAttachment {
  return {
    kind: "program",
    title: course.title,
    meta: "Програма",
    text: "",
    full: false,
    block: null,
    courseSlug: course.slug,
    media: null,
    durationMin: null,
    href: programHref(course),
  };
}

export function blockAttachment(
  course: AttachmentCourse,
  lesson: AttachmentLesson,
  blockId: string | null,
  full: boolean,
): FeedAttachment {
  const block = blockId ? feedBlockText(lesson.blocks, blockId) : null;
  const lessonBlock = blockId ? feedBlockOf(lesson.blocks, blockId) : null;
  // A block the author has since deleted takes its words with it; the post
  // keeps pointing at the lesson's programme rather than losing its card.
  const text = block?.text ?? "";
  return {
    kind: "block",
    title: block?.title || lesson.title,
    meta: [course.title, lesson.dayIndex ? `день ${lesson.dayIndex}` : lesson.title].filter(Boolean).join(" · "),
    text: full ? text : excerptOf(text),
    full,
    /* Only a block the author chose to show whole travels whole. An excerpt
       sends its opening words alone: the page source must not carry a paid
       lesson's block in full behind a visual clamp. */
    block: full ? lessonBlock : null,
    courseSlug: course.slug,
    media: block?.media ?? null,
    durationMin: block?.durationMin ?? null,
    href: programHref(course),
  };
}
