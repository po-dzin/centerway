"use client";

/**
 * A post's words, drawn from the token tree of `parseFeedBody` (2026-10-17).
 *
 * Every token becomes one React element; no string the author wrote reaches
 * the page as HTML. Links go out only to http(s) — the parser has already
 * refused anything else — and always with `FEED_LINK_REL` in a new tab.
 *
 * MARKS. A reader's marks are counted in the TEXT the reader sees: the
 * concatenation of the text tokens, which is exactly what `Range.toString()`
 * returns over the drawn body (a `<br>`, a list marker and a paragraph edge
 * add nothing to either). `feedBodyText` is that string, so the card's
 * selection offsets, the stored quote and the drawing here agree by
 * construction. A mark that crosses an element edge is drawn in pieces, each
 * of which opens the same mark.
 */

import { forwardRef, type ReactNode } from "react";

import { FEED_LINK_REL, type FeedBlockToken, type FeedInline } from "@/lib/feed/format";

import styles from "./Feed.module.css";

export type PlacedMark = { clientId: string; note: string | null; from: number; to: number };

function inlineText(nodes: FeedInline[]): string {
  return nodes
    .map((node) => (node.t === "text" ? node.text : node.t === "br" ? "" : inlineText(node.children)))
    .join("");
}

/** The words a reader sees, in drawing order — what a mark's offsets count. */
export function feedBodyText(tokens: FeedBlockToken[]): string {
  return tokens
    .map((block) =>
      block.t === "ul" || block.t === "ol" ? block.items.map(inlineText).join("") : inlineText(block.children),
    )
    .join("");
}

type Draw = {
  marks: PlacedMark[];
  onMark?: (mark: PlacedMark, target: HTMLElement) => void;
  /** The running offset into `feedBodyText`, advanced as text is drawn. */
  at: number;
  key: number;
};

/** One run of text, cut where marks begin and end. */
function drawText(text: string, draw: Draw): ReactNode[] {
  const start = draw.at;
  const end = start + text.length;
  draw.at = end;
  const out: ReactNode[] = [];
  let cursor = start;
  for (const mark of draw.marks) {
    if (mark.to <= cursor || mark.from >= end) continue;
    const from = Math.max(mark.from, cursor);
    const to = Math.min(mark.to, end);
    if (from > cursor) out.push(text.slice(cursor - start, from - start));
    out.push(
      <mark
        key={`m${draw.key++}`}
        className={styles.mark}
        data-note={mark.note ? "" : undefined}
        title={mark.note ?? undefined}
        onClick={(event) => draw.onMark?.(mark, event.currentTarget)}
      >
        {text.slice(from - start, to - start)}
      </mark>,
    );
    cursor = to;
  }
  if (cursor < end) out.push(text.slice(cursor - start));
  return out;
}

function drawInline(nodes: FeedInline[], draw: Draw): ReactNode[] {
  return nodes.map((node) => {
    const key = `i${draw.key++}`;
    switch (node.t) {
      case "text":
        return <span key={key}>{drawText(node.text, draw)}</span>;
      case "br":
        return <br key={key} />;
      case "strong":
        return <strong key={key}>{drawInline(node.children, draw)}</strong>;
      case "em":
        return <em key={key}>{drawInline(node.children, draw)}</em>;
      case "link":
        return (
          <a key={key} className={styles.bodyLink} href={node.href} target="_blank" rel={FEED_LINK_REL}>
            {drawInline(node.children, draw)}
          </a>
        );
    }
  });
}

function drawBlock(block: FeedBlockToken, draw: Draw): ReactNode {
  const key = `b${draw.key++}`;
  switch (block.t) {
    case "p":
      return <p key={key}>{drawInline(block.children, draw)}</p>;
    case "quote":
      return <blockquote key={key}>{drawInline(block.children, draw)}</blockquote>;
    case "ul":
      return (
        <ul key={key}>
          {block.items.map((item, index) => (
            <li key={index}>{drawInline(item, draw)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={key} start={block.start}>
          {block.items.map((item, index) => (
            <li key={index}>{drawInline(item, draw)}</li>
          ))}
        </ol>
      );
  }
}

export const FeedBody = forwardRef<
  HTMLDivElement,
  {
    tokens: FeedBlockToken[];
    marks?: PlacedMark[];
    onMark?: (mark: PlacedMark, target: HTMLElement) => void;
    className?: string;
    /** Folded to the card's line count (`--clamp`). */
    clamped?: boolean;
    onSelect?: () => void;
  }
>(function FeedBody({ tokens, marks = [], onMark, className, clamped, onSelect }, ref) {
  const draw: Draw = { marks, onMark, at: 0, key: 0 };
  return (
    <div className={className} ref={ref} data-clamped={clamped || undefined} onMouseUp={onSelect} onKeyUp={onSelect}>
      {tokens.map((block) => drawBlock(block, draw))}
    </div>
  );
});
