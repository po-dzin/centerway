/**
 * CenterWay LMS core — publish readiness.
 *
 * PURE TS. No DOM, no React, no Next, no npm deps.
 *
 * `validateCourse` answers "is the structure intact?". This answers a different
 * question: "may this course be shown to a learner?".
 *
 * The split exists because of how courses are actually authored. A course is
 * assembled from an author's raw material — documents, videos, a report
 * template — and the parts that are missing are marked, not invented. That is a
 * hard rule in a health context: an agent may leave a hole, it may not fill one
 * in. `[ЗАПОВНИ: …]` is the marker, and this function is what makes it binding —
 * a course carrying a marker is structurally valid and still unpublishable.
 *
 * Same shape as the rest of the core: machine-readable `lms_ready_*:path` codes,
 * so the seed CLI, the builder (H2) and the agent's tools (H3) all report the
 * same blockers in the same words.
 */

import type { LessonBlock, RichTextNode } from "./blocks";
import { flattenLessons, type Course } from "./course";
import { inlineToPlainText, type InlineText } from "./inline";

/** Authoring marker for "the author still owes us this". */
export const PLACEHOLDER_MARKER = "[ЗАПОВНИ";

export type ReadinessBlocker = {
  /** `lms_ready_*` — stable, machine-readable. */
  code: string;
  /** Where it sits, e.g. `way21.modules[1].lessons[0].blocks[2]`. */
  path: string;
  /** Human-readable detail: the marker text, the offending value. */
  detail?: string;
};

export type CourseReadiness = {
  ready: boolean;
  blockers: ReadinessBlocker[];
};

function textOf(value: InlineText | undefined): string {
  return value === undefined ? "" : inlineToPlainText(value);
}

function hasMarker(value: string): boolean {
  return value.includes(PLACEHOLDER_MARKER);
}

function richTextOf(nodes: RichTextNode[]): string {
  return nodes
    .map((node) =>
      node.kind === "ul" || node.kind === "ol"
        ? node.items.map((item) => textOf(item)).join(" ")
        : textOf(node.text)
    )
    .join(" ");
}

/** Every author-visible string in a block, flattened for marker scanning. */
function blockText(block: LessonBlock): string {
  switch (block.type) {
    case "lesson_objective":
    case "boundary_note":
    case "quote":
      return textOf(block.text);
    case "rich_text":
      return richTextOf(block.content);
    case "protocol_step":
    case "practice_block":
      return `${textOf(block.title)} ${textOf(block.text)}`;
    case "checklist":
      return `${textOf(block.title)} ${block.items.map((item) => textOf(item.text)).join(" ")}`;
    case "video":
      return `${block.videoId} ${textOf(block.title)}`;
    case "image":
      return `${block.src} ${block.alt} ${textOf(block.caption)}`;
    case "faq_block":
      return block.items.map((item) => `${textOf(item.question)} ${textOf(item.answer)}`).join(" ");
    case "cta":
      return `${block.label} ${block.href} ${textOf(block.text)}`;
    default:
      return "";
  }
}

/**
 * Blockers that would stop this course from being published.
 *
 * A structurally invalid course throws from `validateCourse` long before this
 * runs, so everything here is about content completeness, not shape.
 */
export function courseReadiness(course: Course): CourseReadiness {
  const blockers: ReadinessBlocker[] = [];
  const add = (code: string, path: string, detail?: string) => blockers.push({ code, path, detail });

  const courseText = `${course.title} ${textOf(course.summary)}`;
  if (hasMarker(courseText)) add("lms_ready_placeholder", `${course.slug}`, courseText.trim());

  let bodyFacing = false;
  let hasBoundary = false;

  for (const { module, lesson } of flattenLessons(course)) {
    const lessonPath = `${course.slug}.${module.slug}.${lesson.slug}`;

    if (hasMarker(`${lesson.title} ${textOf(lesson.summary)}`)) {
      add("lms_ready_placeholder", lessonPath, lesson.title);
    }

    lesson.blocks.forEach((block, index) => {
      const path = `${lessonPath}.blocks[${index}]`;
      const text = blockText(block);

      if (hasMarker(text)) add("lms_ready_placeholder", path, text.trim().slice(0, 160));

      if (block.type === "boundary_note") hasBoundary = true;
      if (block.type === "protocol_step" || block.type === "practice_block") bodyFacing = true;

      // A link that never resolved is worse than a missing one: it looks live.
      if (block.type === "cta" && !/^(https?:\/\/|\/|mailto:|tg:)/.test(block.href)) {
        add("lms_ready_invalid_href", path, block.href);
      }

      // Video ids are opaque, so the only honest check is "is it plausibly one".
      if (block.type === "video" && !/^[A-Za-z0-9_-]{6,}$/.test(block.videoId)) {
        add("lms_ready_invalid_video_id", path, block.videoId);
      }

      if (block.type === "image" && !/^(https?:\/\/|\/)/.test(block.src)) {
        add("lms_ready_invalid_image_src", path, block.src);
      }
    });
  }

  // Bounded health claims are a brand-contract invariant: anything that asks the
  // learner to do something to their body states its limit.
  if ((bodyFacing || course.schedule.mode === "daily") && !hasBoundary) {
    add("lms_ready_missing_boundary", course.slug);
  }

  return { ready: blockers.length === 0, blockers };
}

/** One-line-per-blocker rendering, shared by the seed CLI and the builder. */
export function formatReadiness(readiness: CourseReadiness): string {
  return readiness.blockers
    .map((blocker) => `  · ${blocker.code} — ${blocker.path}${blocker.detail ? ` — ${blocker.detail}` : ""}`)
    .join("\n");
}
