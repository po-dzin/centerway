/**
 * A lesson block as a post shows it: a title and plain text (2026-10-16).
 *
 * The post stores only WHERE the block is (course, lesson, block id) and
 * whether to show it whole or as an opening; the words are read from the
 * lesson when the post is shown, so a block the author corrects is corrected in
 * the feed too. Plain text on purpose: the feed is not a second lesson reader,
 * and a video or a table is pointed at, not re-rendered.
 */

import { flattenBlocks, inlineToPlainText, type LessonBlock } from "@/lms-core";

export type FeedBlockText = {
  /** What the attachment is called — the block's own title, or null for the lesson's. */
  title: string | null;
  text: string;
  /** A block whose substance is not text: the card points at it instead of quoting it. */
  media: "video" | "image" | null;
  durationMin: number | null;
};

function joinLines(lines: (string | null | undefined)[]): string {
  return lines
    .map((line) => (line ?? "").trim())
    .filter(Boolean)
    .join("\n");
}

/** The block's words, or null when there is no such block in the lesson. */
export function feedBlockText(blocks: unknown, blockId: string): FeedBlockText | null {
  if (!Array.isArray(blocks)) return null;
  let block: Exclude<LessonBlock, { type: "group" }> | undefined;
  try {
    block = flattenBlocks(blocks as LessonBlock[]).find((candidate) => candidate.id === blockId);
  } catch {
    return null;
  }
  if (!block) return null;

  const plain = inlineToPlainText;
  switch (block.type) {
    case "lesson_objective":
    case "boundary_note":
      return { title: null, text: plain(block.text), media: null, durationMin: null };
    case "quote":
      return {
        title: null,
        text: joinLines([plain(block.text), block.author ? `— ${block.author}` : null]),
        media: null,
        durationMin: null,
      };
    case "rich_text":
      return {
        title: null,
        text: joinLines(
          block.content.flatMap((node) =>
            node.kind === "ul" || node.kind === "ol"
              ? node.items.map((item) => `• ${plain(item)}`)
              : [plain(node.text)],
          ),
        ),
        media: null,
        durationMin: null,
      };
    case "protocol_step":
      return {
        title: plain(block.title),
        text: block.text ? plain(block.text) : "",
        media: null,
        durationMin: null,
      };
    case "practice_block":
      return {
        title: plain(block.title),
        text: block.text ? plain(block.text) : "",
        media: null,
        durationMin: block.durationMin ?? null,
      };
    case "checklist":
      return {
        title: block.title ? plain(block.title) : null,
        text: joinLines(block.items.map((item) => `• ${plain(item.text)}`)),
        media: null,
        durationMin: null,
      };
    case "faq_block":
      return {
        title: null,
        text: joinLines(block.items.flatMap((item) => [plain(item.question), plain(item.answer)])),
        media: null,
        durationMin: null,
      };
    case "video":
      return {
        title: block.title ? plain(block.title) : null,
        text: "",
        media: "video",
        durationMin: block.durationMin ?? null,
      };
    case "image":
      return {
        title: block.caption ? plain(block.caption) : null,
        text: "",
        media: "image",
        durationMin: null,
      };
    default:
      return { title: null, text: "", media: null, durationMin: null };
  }
}

/** Every block of a lesson the composer can offer, with a one-line label. */
export function feedBlockOptions(blocks: unknown): { id: string; label: string; kind: string }[] {
  if (!Array.isArray(blocks)) return [];
  let flat: Exclude<LessonBlock, { type: "group" }>[];
  try {
    flat = flattenBlocks(blocks as LessonBlock[]);
  } catch {
    return [];
  }
  return flat.flatMap((block) => {
    const text = feedBlockText([block], block.id);
    if (!text) return [];
    const label = text.title || text.text.split("\n")[0] || "";
    if (!label && !text.media) return [];
    return [{ id: block.id, label: label.slice(0, 120), kind: block.type }];
  });
}
