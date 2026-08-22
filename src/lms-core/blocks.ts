/**
 * CenterWay LMS core — typed lesson blocks.
 *
 * PURE TS. No DOM, no React, no Next, no npm deps.
 *
 * Blocks are the single contract shared by: the seed pipeline (H1), the author
 * builder (H2), the agent tools (H3), and every renderer (web now, native later).
 * Free-form HTML is deliberately absent — see docs/lms-research-2026-08-15.md §5A.
 *
 * The block vocabulary is fixed by ReOS `Архитектура.md`; this file implements the
 * subset needed for reset-day and way21, and no more.
 */

import {
  assert,
  isNonEmptyString,
  isRecord,
  validateInlineText,
  type InlineText,
} from "./inline";

export type LessonBlockType =
  | "lesson_objective"
  | "rich_text"
  | "protocol_step"
  | "practice_block"
  | "checklist"
  | "video"
  | "image"
  | "quote"
  | "boundary_note"
  | "faq_block"
  | "table"
  | "cta";

/** Paragraph-level shapes inside a rich_text block. Still not HTML. */
export type RichTextNode =
  | { kind: "p"; text: InlineText }
  | { kind: "h3"; text: InlineText }
  | { kind: "ul"; items: InlineText[] }
  | { kind: "ol"; items: InlineText[] };

type BlockBase = { id: string };

export type LessonObjectiveBlock = BlockBase & {
  type: "lesson_objective";
  /** Answers "what is today for?" — one sentence, the lesson's semantic anchor. */
  text: InlineText;
};

export type RichTextBlock = BlockBase & {
  type: "rich_text";
  content: RichTextNode[];
};

export type ProtocolStepBlock = BlockBase & {
  type: "protocol_step";
  /** Position inside the day's protocol, 1-based. */
  step: number;
  title: InlineText;
  text?: InlineText;
  /** Free label, e.g. "07:00" or "натще" — not parsed, rendered as given. */
  timing?: string;
};

export type PracticeBlock = BlockBase & {
  type: "practice_block";
  title: InlineText;
  text?: InlineText;
  durationMin?: number;
};

export type ChecklistBlock = BlockBase & {
  type: "checklist";
  title?: InlineText;
  items: Array<{ id: string; text: InlineText }>;
  /** When true, the lesson cannot be completed until every item is ticked. */
  requiredForCompletion?: boolean;
};

/**
 * Video provider is stored as {provider, id}, never as a URL string, so the
 * 2026-08-15 "unlisted YouTube for now" decision stays a data migration rather
 * than a player rewrite when offline/native forces a move to Mux or Bunny.
 */
export type VideoProvider = "youtube";

export type VideoBlock = BlockBase & {
  type: "video";
  provider: VideoProvider;
  videoId: string;
  title?: InlineText;
  durationMin?: number;
};

export type ImageBlock = BlockBase & {
  type: "image";
  src: string;
  alt: string;
  caption?: InlineText;
};

export type QuoteBlock = BlockBase & {
  type: "quote";
  text: InlineText;
  author?: string;
};

/**
 * Bounded health claims are a brand-contract invariant, not decoration:
 * every protocol that touches the body carries an explicit limit block.
 */
export type BoundaryNoteBlock = BlockBase & {
  type: "boundary_note";
  text: InlineText;
};

export type FaqBlock = BlockBase & {
  type: "faq_block";
  items: Array<{ id: string; question: InlineText; answer: InlineText }>;
};

/**
 * A table — the one shape a list cannot carry.
 *
 * Added because authors kept reaching for one: a dosage per day, a food per
 * stage, a symptom against what to do about it. Written as rows of inline
 * text rather than as HTML, for the same reason nothing else here is HTML —
 * a native renderer has to be able to draw it too, and a phone draws a wide
 * table as stacked pairs, not as a scrolling grid.
 *
 * `head` is optional and separate from `rows`. A header row that lived inside
 * `rows[0]` would be indistinguishable from data to every renderer, which is
 * exactly the information a screen reader needs to announce a cell's column.
 * Column count is fixed by the header when there is one, and by the first row
 * when there is not — a ragged table is a table nothing can lay out.
 */
export type TableBlock = BlockBase & {
  type: "table";
  title?: InlineText;
  head?: InlineText[];
  rows: InlineText[][];
};

export type CtaBlock = BlockBase & {
  type: "cta";
  label: string;
  href: string;
  text?: InlineText;
};

export type LessonBlock =
  | LessonObjectiveBlock
  | RichTextBlock
  | ProtocolStepBlock
  | PracticeBlock
  | ChecklistBlock
  | VideoBlock
  | ImageBlock
  | QuoteBlock
  | BoundaryNoteBlock
  | FaqBlock
  | TableBlock
  | CtaBlock;

export const LESSON_BLOCK_TYPES: readonly LessonBlockType[] = [
  "lesson_objective",
  "rich_text",
  "protocol_step",
  "practice_block",
  "checklist",
  "video",
  "image",
  "quote",
  "boundary_note",
  "faq_block",
  "table",
  "cta",
];

function validateRichTextNode(node: unknown, path: string): asserts node is RichTextNode {
  assert(isRecord(node), `lms_block_invalid_node:${path}`);
  const kind = node.kind;
  assert(
    kind === "p" || kind === "h3" || kind === "ul" || kind === "ol",
    `lms_block_unknown_node_kind:${path}`
  );

  if (kind === "p" || kind === "h3") {
    validateInlineText(node.text, `${path}.text`);
    return;
  }

  assert(Array.isArray(node.items) && node.items.length > 0, `lms_block_empty_list:${path}`);
  node.items.forEach((item, index) => validateInlineText(item, `${path}.items[${index}]`));
}

/**
 * Validates one block and narrows its type.
 *
 * Error codes follow the repo's generator convention (`code:path`) so seed,
 * API and builder all fail with the same machine-readable reason.
 */
export function validateLessonBlock(block: unknown, path: string): asserts block is LessonBlock {
  assert(isRecord(block), `lms_block_invalid_shape:${path}`);
  assert(isNonEmptyString(block.id), `lms_block_missing_id:${path}`);

  const type = block.type;
  assert(
    typeof type === "string" && (LESSON_BLOCK_TYPES as readonly string[]).includes(type),
    `lms_block_unknown_type:${path}`
  );

  switch (type as LessonBlockType) {
    case "lesson_objective":
    case "boundary_note":
    case "quote":
      validateInlineText(block.text, `${path}.text`);
      return;

    case "rich_text":
      assert(Array.isArray(block.content) && block.content.length > 0, `lms_block_empty_content:${path}`);
      block.content.forEach((node, index) => validateRichTextNode(node, `${path}.content[${index}]`));
      return;

    case "protocol_step":
      assert(
        typeof block.step === "number" && Number.isInteger(block.step) && block.step > 0,
        `lms_block_invalid_step:${path}`
      );
      validateInlineText(block.title, `${path}.title`);
      if (block.text !== undefined) validateInlineText(block.text, `${path}.text`);
      return;

    case "practice_block":
      validateInlineText(block.title, `${path}.title`);
      if (block.text !== undefined) validateInlineText(block.text, `${path}.text`);
      if (block.durationMin !== undefined) {
        assert(typeof block.durationMin === "number" && block.durationMin > 0, `lms_block_invalid_duration:${path}`);
      }
      return;

    case "checklist": {
      if (block.title !== undefined) validateInlineText(block.title, `${path}.title`);
      assert(Array.isArray(block.items) && block.items.length > 0, `lms_block_empty_checklist:${path}`);
      const seen = new Set<string>();
      block.items.forEach((item, index) => {
        assert(isRecord(item), `lms_block_invalid_checklist_item:${path}.items[${index}]`);
        assert(isNonEmptyString(item.id), `lms_block_checklist_item_missing_id:${path}.items[${index}]`);
        assert(!seen.has(item.id), `lms_block_checklist_duplicate_item_id:${path}.items[${index}]`);
        seen.add(item.id);
        validateInlineText(item.text, `${path}.items[${index}].text`);
      });
      return;
    }

    case "video":
      assert(block.provider === "youtube", `lms_block_unsupported_video_provider:${path}`);
      assert(isNonEmptyString(block.videoId), `lms_block_missing_video_id:${path}`);
      if (block.title !== undefined) validateInlineText(block.title, `${path}.title`);
      return;

    case "image":
      assert(isNonEmptyString(block.src), `lms_block_missing_image_src:${path}`);
      // Alt is mandatory: a11y is a release gate in this repo, not a nicety.
      assert(isNonEmptyString(block.alt), `lms_block_missing_image_alt:${path}`);
      if (block.caption !== undefined) validateInlineText(block.caption, `${path}.caption`);
      return;

    case "faq_block": {
      assert(Array.isArray(block.items) && block.items.length > 0, `lms_block_empty_faq:${path}`);
      block.items.forEach((item, index) => {
        assert(isRecord(item), `lms_block_invalid_faq_item:${path}.items[${index}]`);
        assert(isNonEmptyString(item.id), `lms_block_faq_item_missing_id:${path}.items[${index}]`);
        validateInlineText(item.question, `${path}.items[${index}].question`);
        validateInlineText(item.answer, `${path}.items[${index}].answer`);
      });
      return;
    }

    case "table": {
      if (block.title !== undefined) validateInlineText(block.title, `${path}.title`);
      assert(Array.isArray(block.rows) && block.rows.length > 0, `lms_block_empty_table:${path}`);

      let columns: number | null = null;
      if (block.head !== undefined) {
        assert(Array.isArray(block.head) && block.head.length > 0, `lms_block_empty_table_head:${path}`);
        block.head.forEach((cell, index) => validateInlineText(cell, `${path}.head[${index}]`));
        columns = block.head.length;
      }

      block.rows.forEach((row, rowIndex) => {
        assert(Array.isArray(row) && row.length > 0, `lms_block_empty_table_row:${path}.rows[${rowIndex}]`);
        if (columns === null) columns = row.length;
        // Ragged rows are rejected here rather than padded: a renderer that
        // guesses the missing cell writes content the author never wrote.
        assert(row.length === columns, `lms_block_ragged_table:${path}.rows[${rowIndex}]`);
        row.forEach((cell, cellIndex) => validateInlineText(cell, `${path}.rows[${rowIndex}][${cellIndex}]`));
      });
      return;
    }

    case "cta":
      assert(isNonEmptyString(block.label), `lms_block_missing_cta_label:${path}`);
      assert(isNonEmptyString(block.href), `lms_block_missing_cta_href:${path}`);
      if (block.text !== undefined) validateInlineText(block.text, `${path}.text`);
      return;
  }
}

/** Every checklist item id in a lesson, used to fold checklist progress. */
export function collectChecklistItemIds(blocks: LessonBlock[]): string[] {
  const ids: string[] = [];
  for (const block of blocks) {
    if (block.type === "checklist") {
      for (const item of block.items) ids.push(item.id);
    }
  }
  return ids;
}

/** Checklist items that gate lesson completion. */
export function collectRequiredChecklistItemIds(blocks: LessonBlock[]): string[] {
  const ids: string[] = [];
  for (const block of blocks) {
    if (block.type === "checklist" && block.requiredForCompletion) {
      for (const item of block.items) ids.push(item.id);
    }
  }
  return ids;
}
