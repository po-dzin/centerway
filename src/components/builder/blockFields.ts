"use client";

/**
 * What is editable inside each block type, as data.
 *
 * ELEVEN block types, each with its own field set, and a hand-written form per
 * type would be eleven components that drift apart and one more to write every
 * time the vocabulary grows. Instead each block is DESCRIBED as a flat list of
 * fields addressed by path, and one renderer draws them all. A twelfth block
 * type is a few lines here, not a new component.
 *
 * The descriptions are exhaustive on purpose: every authored field of every
 * block in `lms-core/blocks.ts` appears. A field that is merely missing from
 * this table is invisible in the builder while still being in the data — the
 * quietest possible way for an editor to be wrong.
 */

import type { LessonBlock, RichTextNode } from "@/lms-core";

export type FieldKind = "inline" | "text" | "number" | "boolean";

export type BlockField = {
  /** Address inside the block, e.g. ["content", 2, "items", 0]. */
  path: (string | number)[];
  label: string;
  kind: FieldKind;
  /** Long prose gets a textarea, short identifiers a single line. */
  multiline?: boolean;
};

export const BLOCK_TYPE_LABELS: Record<LessonBlock["type"], string> = {
  lesson_objective: "Мета уроку",
  rich_text: "Текст",
  protocol_step: "Крок протоколу",
  practice_block: "Практика",
  checklist: "Чек-лист",
  video: "Відео",
  image: "Зображення",
  quote: "Цитата",
  boundary_note: "Межі та застереження",
  faq_block: "Питання і відповіді",
  cta: "Кнопка",
};

const RICH_NODE_LABELS: Record<RichTextNode["kind"], string> = {
  p: "Абзац",
  h3: "Підзаголовок",
  ul: "Список",
  ol: "Нумерований список",
};

export function describeBlock(block: LessonBlock): BlockField[] {
  switch (block.type) {
    case "lesson_objective":
      return [{ path: ["text"], label: "Мета", kind: "inline", multiline: true }];

    case "boundary_note":
      return [{ path: ["text"], label: "Застереження", kind: "inline", multiline: true }];

    case "rich_text":
      return block.content.flatMap((node, index) => {
        const label = RICH_NODE_LABELS[node.kind];
        if (node.kind === "ul" || node.kind === "ol") {
          return node.items.map((_, itemIndex) => ({
            path: ["content", index, "items", itemIndex],
            label: `${label} — пункт ${itemIndex + 1}`,
            kind: "inline" as const,
            multiline: true,
          }));
        }
        return [
          {
            path: ["content", index, "text"],
            label,
            kind: "inline" as const,
            multiline: node.kind !== "h3",
          },
        ];
      });

    case "protocol_step":
      return [
        { path: ["step"], label: "Номер кроку", kind: "number" },
        { path: ["timing"], label: "Час або умова", kind: "text" },
        { path: ["title"], label: "Назва", kind: "inline" },
        { path: ["text"], label: "Опис", kind: "inline", multiline: true },
      ];

    case "practice_block":
      return [
        { path: ["title"], label: "Назва", kind: "inline" },
        { path: ["durationMin"], label: "Тривалість, хв", kind: "number" },
        { path: ["text"], label: "Опис", kind: "inline", multiline: true },
      ];

    case "checklist":
      return [
        { path: ["title"], label: "Назва", kind: "inline" },
        {
          path: ["requiredForCompletion"],
          label: "Обов'язковий для завершення уроку",
          kind: "boolean",
        },
        ...block.items.map((_, index) => ({
          path: ["items", index, "text"],
          label: `Пункт ${index + 1}`,
          kind: "inline" as const,
          multiline: true,
        })),
      ];

    case "video":
      return [
        { path: ["videoId"], label: "ID відео на YouTube", kind: "text" },
        { path: ["title"], label: "Підпис", kind: "inline" },
        { path: ["durationMin"], label: "Тривалість, хв", kind: "number" },
      ];

    case "image":
      return [
        { path: ["src"], label: "Шлях до файлу", kind: "text" },
        { path: ["alt"], label: "Опис для тих, хто не бачить зображення", kind: "text", multiline: true },
        { path: ["caption"], label: "Підпис", kind: "inline" },
      ];

    case "quote":
      return [
        { path: ["text"], label: "Цитата", kind: "inline", multiline: true },
        { path: ["author"], label: "Автор", kind: "text" },
      ];

    case "faq_block":
      return block.items.flatMap((_, index) => [
        { path: ["items", index, "question"], label: `Питання ${index + 1}`, kind: "inline" as const },
        {
          path: ["items", index, "answer"],
          label: `Відповідь ${index + 1}`,
          kind: "inline" as const,
          multiline: true,
        },
      ]);

    case "cta":
      return [
        { path: ["label"], label: "Напис на кнопці", kind: "text" },
        { path: ["href"], label: "Посилання", kind: "text" },
        { path: ["text"], label: "Пояснення поруч", kind: "inline", multiline: true },
      ];
  }
}

/** Reads a value at a path. Missing intermediate keys read as undefined, not a throw. */
export function readPath(source: unknown, path: (string | number)[]): unknown {
  let current: unknown = source;
  for (const key of path) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

/**
 * Returns a copy with `path` set to `value`.
 *
 * Copies rather than mutating at every level: React state and the "unsaved
 * changes" comparison both need the old object to still be the old object.
 *
 * `undefined` DELETES the key. Optional fields — a step's `timing`, a video's
 * `durationMin` — are absent, not empty, in the contract, and writing `""`
 * where the validator expects a non-empty string or nothing is precisely how an
 * editor produces a course that no longer validates.
 */
export function writePath<T>(source: T, path: (string | number)[], value: unknown): T {
  if (path.length === 0) return value as T;

  const [key, ...rest] = path;

  if (Array.isArray(source)) {
    const next = [...source];
    next[key as number] = writePath(next[key as number], rest, value);
    return next as unknown as T;
  }

  const record = { ...(source as Record<string | number, unknown>) };
  if (rest.length === 0) {
    if (value === undefined) delete record[key];
    else record[key] = value;
  } else {
    record[key] = writePath(record[key], rest, value);
  }
  return record as unknown as T;
}
