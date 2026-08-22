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

export type FieldKind = "inline" | "text" | "number" | "boolean" | "youtube";

export type BlockField = {
  /** Address inside the block, e.g. ["content", 2, "items", 0]. */
  path: (string | number)[];
  label: string;
  kind: FieldKind;
  /** Long prose gets a textarea, short identifiers a single line. */
  multiline?: boolean;
  /** One line under the input, for a rule the label cannot carry. */
  hint?: string;
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
  table: "Таблиця",
  cta: "Кнопка",
};

/**
 * What each block is FOR, one line, shown in the picker.
 *
 * Eleven names in a list say nothing about when to reach for «Практика» rather
 * than «Крок протоколу» — and an author choosing wrong does not find out until
 * a learner sees a timing rendered as a duration. The sentence is the whole
 * difference between a menu and a vocabulary.
 */
export const BLOCK_TYPE_HINTS: Record<LessonBlock["type"], string> = {
  lesson_objective: "Одне речення: для чого цей урок. Стоїть першим.",
  rich_text: "Абзаци, підзаголовки та списки — основне тіло уроку.",
  protocol_step: "Пронумерований крок дня з часом або умовою.",
  practice_block: "Вправа, яку виконують, із тривалістю.",
  checklist: "Пункти, які учень відмічає. Можуть вимагатися для завершення уроку.",
  video: "Відео на YouTube — вставте посилання.",
  image: "Зображення з обов'язковим описом.",
  quote: "Цитата з автором.",
  boundary_note: "Межі й застереження. Обов'язковий у всьому, що стосується тіла.",
  faq_block: "Питання і відповіді.",
  table: "Рядки й колонки — доза, етап, продукт. Те, що список не тримає.",
  cta: "Кнопка з посиланням і поясненням поруч.",
};

/**
 * TWO LISTS, BECAUSE THEY ARE TWO DIFFERENT QUESTIONS.
 *
 * A block that arrives carrying a role is not a type, it is a TEMPLATE. «Мета
 * уроку» is a paragraph that has been told what job it does; «Крок протоколу»
 * is a titled paragraph with a time on it. The learner's renderer and
 * `courseReadiness` both depend on those roles, so they are real and they stay
 * — but they answer "what job does this do in the lesson", and that is not the
 * question an author is asking when they reach for a table halfway through a
 * sentence.
 *
 * So the shapes live in the slash menu, where writing happens, and the roles
 * live behind «Шаблон…», where choosing is the point.
 */
export const BLOCK_STRUCTURE_ORDER: LessonBlock["type"][] = ["table", "video", "image", "quote", "cta"];

export const BLOCK_TEMPLATE_ORDER: LessonBlock["type"][] = [
  "lesson_objective",
  "protocol_step",
  "practice_block",
  "checklist",
  "faq_block",
  "boundary_note",
];

/**
 * The order the picker offers types in — by how often a lesson needs one,
 * not alphabetically and not by the order they happen to sit in the union.
 */
export const BLOCK_TYPE_ORDER: LessonBlock["type"][] = [
  "rich_text",
  ...BLOCK_TEMPLATE_ORDER,
  ...BLOCK_STRUCTURE_ORDER,
];

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

    // `step` is absent on purpose. It is the block's POSITION in the day's
    // protocol, derived by `renumberSteps` the way `order` and `dayIndex` are —
    // a typed one goes wrong the moment a step is inserted in the middle, and
    // goes wrong silently.
    case "protocol_step":
      return [
        { path: ["timing"], label: "Час або умова", kind: "text", hint: "Наприклад «07:00» або «натще». Рендериться як написано." },
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
        {
          path: ["videoId"],
          label: "Посилання на відео",
          kind: "youtube",
          hint: "Вставте адресу з YouTube. Зберігається сам ідентифікатор, тож посилання може бути в будь-якій формі.",
        },
        // NOT a caption. It is the player's accessible name — the sentence a
        // screen reader announces instead of "frame". Labelled «Підпис» until
        // 2026-08-21, which had authors writing captions nobody could ever see:
        // the renderer puts this in the iframe's `title` attribute and draws no
        // text under the video at all.
        {
          path: ["title"],
          label: "Назва відео для читалок екрана",
          kind: "inline",
          hint: "Не видно на сторінці. Це те, що озвучить читалка замість «фрейм».",
        },
        { path: ["durationMin"], label: "Тривалість, хв", kind: "number" },
      ];

    case "image":
      return [
        {
          path: ["src"],
          label: "Шлях до файлу",
          kind: "text",
          hint: "Шлях від кореня сайту (/cw/…) або повне посилання https://…",
        },
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

    case "table":
      return [
        { path: ["title"], label: "Назва таблиці", kind: "inline" },
        ...(block.head ?? []).map((_, index) => ({
          path: ["head", index],
          label: `Заголовок колонки ${index + 1}`,
          kind: "inline" as const,
        })),
        ...block.rows.flatMap((row, rowIndex) =>
          row.map((_, cellIndex) => ({
            path: ["rows", rowIndex, cellIndex],
            label: `Рядок ${rowIndex + 1}, колонка ${cellIndex + 1}`,
            kind: "inline" as const,
          }))
        ),
      ];

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
