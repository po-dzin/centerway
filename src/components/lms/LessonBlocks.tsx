"use client";

/**
 * Block renderer — the web binding of the typed block contract.
 *
 * The contract itself lives in src/lms-core/blocks.ts and knows nothing about
 * the DOM. A native app would ship a different file with the same switch,
 * which is exactly why lesson content is structured data and never HTML
 * (docs/lms-research-2026-08-15.md §5A).
 */

import type { JSX } from "react";

import { toSpans, type InlineText, type LessonBlock, type RichTextNode } from "@/lms-core";
import styles from "./Lms.module.css";

function Inline({ value }: { value: InlineText }) {
  return (
    <>
      {toSpans(value).map((span, index) => {
        let node: JSX.Element = <>{span.text}</>;
        if (span.bold) node = <strong>{node}</strong>;
        if (span.italic) node = <em>{node}</em>;
        if (span.href) {
          node = (
            <a href={span.href} rel="noopener noreferrer">
              {node}
            </a>
          );
        }
        return <span key={index}>{node}</span>;
      })}
    </>
  );
}

function RichNode({ node }: { node: RichTextNode }) {
  switch (node.kind) {
    case "p":
      return (
        <p className={styles.paragraph}>
          <Inline value={node.text} />
        </p>
      );
    case "h3":
      return (
        <h3 className={styles.heading}>
          <Inline value={node.text} />
        </h3>
      );
    case "ul":
      return (
        <ul className={styles.list}>
          {node.items.map((item, index) => (
            <li key={index}>
              <Inline value={item} />
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className={styles.listOrdered}>
          {node.items.map((item, index) => (
            <li key={index}>
              <Inline value={item} />
            </li>
          ))}
        </ol>
      );
  }
}

export type ChecklistState = Record<string, boolean>;

export type BlockRendererProps = {
  block: LessonBlock;
  checklist: ChecklistState;
  onToggleChecklistItem: (itemId: string, checked: boolean) => void;
  disabled?: boolean;
};

export function BlockRenderer({ block, checklist, onToggleChecklistItem, disabled }: BlockRendererProps) {
  switch (block.type) {
    case "lesson_objective":
      return (
        <p className={styles.objective}>
          <Inline value={block.text} />
        </p>
      );

    case "rich_text":
      return (
        <div className={styles.blocks}>
          {block.content.map((node, index) => (
            <RichNode key={index} node={node} />
          ))}
        </div>
      );

    case "protocol_step":
      return (
        <div className={styles.step}>
          <span className={styles.stepNumber} aria-hidden="true">
            {block.step}
          </span>
          <div>
            {block.timing ? <span className={styles.stepTiming}>{block.timing}</span> : null}
            <h3 className={styles.stepTitle}>
              <Inline value={block.title} />
            </h3>
            {block.text ? (
              <p className={styles.stepText}>
                <Inline value={block.text} />
              </p>
            ) : null}
          </div>
        </div>
      );

    case "practice_block":
      return (
        <section className={styles.practice}>
          <div className={styles.practiceHead}>
            <h3 className={styles.stepTitle}>
              <Inline value={block.title} />
            </h3>
            {block.durationMin ? <span className={styles.outlineState}>{block.durationMin} хв</span> : null}
          </div>
          {block.text ? (
            <p className={styles.stepText}>
              <Inline value={block.text} />
            </p>
          ) : null}
        </section>
      );

    case "checklist":
      return (
        <section className={styles.checklist}>
          {block.title ? (
            <h3 className={styles.checklistTitle}>
              <Inline value={block.title} />
            </h3>
          ) : null}
          {block.items.map((item) => {
            const checked = checklist[item.id] === true;
            return (
              <label key={item.id} className={checked ? styles.checkItemDone : styles.checkItem}>
                <input
                  className={styles.checkBox}
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={(event) => onToggleChecklistItem(item.id, event.target.checked)}
                />
                <span>
                  <Inline value={item.text} />
                </span>
              </label>
            );
          })}
        </section>
      );

    case "video":
      // Unlisted YouTube is the 2026-08-15 decision; the block stores
      // {provider, id}, so switching providers stays a data migration.
      return (
        <iframe
          className={styles.media}
          src={`https://www.youtube-nocookie.com/embed/${block.videoId}`}
          title={block.title ? toSpans(block.title).map((span) => span.text).join("") : "Відео уроку"}
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      );

    case "image":
      return (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element -- authored content, arbitrary remote hosts */}
          <img className={styles.image} src={block.src} alt={block.alt} loading="lazy" />
          {block.caption ? (
            <figcaption className={styles.caption}>
              <Inline value={block.caption} />
            </figcaption>
          ) : null}
        </figure>
      );

    case "quote":
      return (
        <blockquote className={styles.quote}>
          <Inline value={block.text} />
          {block.author ? <span className={styles.quoteAuthor}>{block.author}</span> : null}
        </blockquote>
      );

    case "boundary_note":
      // Bounded health claims are a brand invariant — rendered, never hidden.
      return (
        <aside className={styles.boundary}>
          <Inline value={block.text} />
        </aside>
      );

    case "faq_block":
      return (
        <section>
          {block.items.map((item) => (
            <details key={item.id} className={styles.faqItem}>
              <summary className={styles.faqQuestion}>
                <Inline value={item.question} />
              </summary>
              <p className={styles.faqAnswer}>
                <Inline value={item.answer} />
              </p>
            </details>
          ))}
        </section>
      );

    case "cta":
      return (
        <div className={styles.ctaBlock}>
          {block.text ? (
            <p className={styles.paragraph}>
              <Inline value={block.text} />
            </p>
          ) : null}
          <a className={styles.ctaLink} href={block.href}>
            {block.label}
          </a>
        </div>
      );
  }
}
