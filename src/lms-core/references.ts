/**
 * Stable internal references inside authored lesson text.
 *
 * The stored href is an entity identity, not a route. Renderers resolve it
 * against the current course, so renaming a lesson or changing its slug does
 * not leave authored prose pointing at an old address.
 */

import type { LessonBlock } from "./blocks";
import { flattenLessons, type Course } from "./course";
import { inlineToPlainText } from "./inline";

export type InternalReference =
  | { kind: "lesson"; lessonId: string }
  | { kind: "block"; lessonId: string; blockId: string };

export type InternalReferenceTarget = InternalReference & {
  key: string;
  slug: string;
  label: string;
  moduleTitle: string;
  moduleId: string;
  lessonTitle: string;
  lessonIndex: number;
  referenceModule: boolean;
  dayIndex?: number;
};

const LESSON_PREFIX = "cw-ref:lesson:";
const BLOCK_PREFIX = "cw-ref:block:";

export function internalLessonReferenceHref(lessonId: string): string {
  return `${LESSON_PREFIX}${encodeURIComponent(lessonId)}`;
}

export function internalBlockReferenceHref(lessonId: string, blockId: string): string {
  return `${BLOCK_PREFIX}${encodeURIComponent(lessonId)}:${encodeURIComponent(blockId)}`;
}

export function parseInternalReference(href: string | undefined): InternalReference | null {
  if (!href) return null;
  if (href.startsWith(LESSON_PREFIX)) {
    const lessonId = decodePart(href.slice(LESSON_PREFIX.length));
    return lessonId ? { kind: "lesson", lessonId } : null;
  }
  if (!href.startsWith(BLOCK_PREFIX)) return null;
  const [lessonPart, blockPart, ...rest] = href.slice(BLOCK_PREFIX.length).split(":");
  if (rest.length > 0) return null;
  const lessonId = decodePart(lessonPart);
  const blockId = decodePart(blockPart);
  return lessonId && blockId ? { kind: "block", lessonId, blockId } : null;
}

export function internalReferenceKey(reference: InternalReference): string {
  return reference.kind === "lesson"
    ? internalLessonReferenceHref(reference.lessonId)
    : internalBlockReferenceHref(reference.lessonId, reference.blockId);
}

export function buildInternalReferenceTargets(course: Course): InternalReferenceTarget[] {
  const targets: InternalReferenceTarget[] = [];
  flattenLessons(course).forEach(({ module, lesson }, lessonIndex) => {
    targets.push({
      kind: "lesson",
      lessonId: lesson.id,
      key: internalLessonReferenceHref(lesson.id),
      slug: lesson.slug,
      label: lesson.title,
      moduleTitle: module.title,
      moduleId: module.id,
      lessonTitle: lesson.title,
      lessonIndex,
      referenceModule: module.reference === true,
      ...(lesson.dayIndex ? { dayIndex: lesson.dayIndex } : {}),
    });

    lesson.blocks.forEach((block) => {
      const label = referenceBlockLabel(block);
      if (!label) return;
      targets.push({
        kind: "block",
        lessonId: lesson.id,
        blockId: block.id,
        key: internalBlockReferenceHref(lesson.id, block.id),
        slug: lesson.slug,
        label,
        moduleTitle: module.title,
        moduleId: module.id,
        lessonTitle: lesson.title,
        lessonIndex,
        referenceModule: module.reference === true,
        ...(lesson.dayIndex ? { dayIndex: lesson.dayIndex } : {}),
      });
    });
  });
  return targets;
}

function decodePart(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value) || null;
  } catch {
    return null;
  }
}

function short(value: string): string {
  const clean = value.trim().replace(/\s+/g, " ");
  return clean.length > 64 ? `${clean.slice(0, 61)}…` : clean;
}

function referenceBlockLabel(block: LessonBlock): string | null {
  switch (block.type) {
    case "lesson_objective":
      return `Мета: ${short(inlineToPlainText(block.text))}`;
    case "protocol_step":
      return `Крок: ${short(inlineToPlainText(block.title))}`;
    case "practice_block":
      return `Практика: ${short(inlineToPlainText(block.title))}`;
    case "checklist":
      return block.title ? `Чекліст: ${short(inlineToPlainText(block.title))}` : "Чекліст";
    case "boundary_note":
      return `Межі: ${short(inlineToPlainText(block.text))}`;
    case "quote":
      return `Цитата: ${short(inlineToPlainText(block.text))}`;
    case "image":
      return block.caption ? `Зображення: ${short(inlineToPlainText(block.caption))}` : `Зображення: ${short(block.alt)}`;
    case "video":
      return block.title ? `Відео: ${short(inlineToPlainText(block.title))}` : "Відео";
    case "table":
      return block.title ? `Таблиця: ${short(inlineToPlainText(block.title))}` : "Таблиця";
    case "cta":
      return `Наступний крок: ${short(block.label)}`;
    case "rich_text":
    case "code":
    case "faq_block":
      return null;
  }
}
