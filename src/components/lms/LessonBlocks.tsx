"use client";

/**
 * Block renderer — the web binding of the typed block contract.
 *
 * The contract itself lives in src/lms-core/blocks.ts and knows nothing about
 * the DOM. A native app would ship a different file with the same switch,
 * which is exactly why lesson content is structured data and never HTML
 * (docs/lms-research-2026-08-15.md §5A).
 */

import { createContext, useContext, type JSX, type ReactNode } from "react";
import Link from "next/link";

import {
  parseInternalReference,
  toSpans,
  type InlineText,
  type InternalReferenceTarget,
  type LessonBlock,
  type RichTextNode,
} from "@/lms-core";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import styles from "./Lms.module.css";

/** A course link that starts with `/` is a CenterWay route, not a foreign URL. */
function isInternalHref(href: string) {
  return href.startsWith("/");
}

/**
 * A lesson's call to action.
 *
 * The href in a course is a PATH when it points inside CenterWay and a URL when
 * it points out. That distinction has to be honoured here, because the lesson
 * is served from `my` and half the platform lives on `www`: a bare `/tests/dosha`
 * in an `<a>` would resolve against the personal host and 404. Internal links go
 * through the surface resolver and `next/link`; external ones open in a new tab,
 * since leaving a lesson by accident costs the reader their place.
 */
function CtaBlock({ href, label, text, authoring = false }: { href: string; label: string; text?: InlineText; authoring?: boolean }) {
  const surfaceHref = useSurfaceHref();
  const internal = isInternalHref(href);

  return (
    <div className={styles.ctaBlock}>
      {text || authoring ? (
        <p className={styles.paragraph}>
          <Inline value={text} path={["text"]} />
        </p>
      ) : null}
      {internal ? (
        <Link className={styles.ctaLink} href={surfaceHref(href)}>
          {label}
        </Link>
      ) : (
        <a className={styles.ctaLink} href={href} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      )}
    </div>
  );
}

type ReferenceContextValue = {
  courseSlug?: string;
  route: "learn" | "build";
  targets: Map<string, InternalReferenceTarget>;
};

const ReferenceContext = createContext<ReferenceContextValue>({ route: "learn", targets: new Map() });

/**
 * How a block's text is made editable WHERE IT IS RENDERED.
 *
 * The builder used to show a read-only copy of the block and put its fields in
 * a panel, so the words of a table were typed three hundred pixels from the
 * table. Writing an editable twin of each of the thirteen block types would
 * have been thirteen components drifting away from these ones — the exact
 * failure `blockFields.ts` exists to prevent.
 *
 * Instead every text leaf here says WHERE IT LIVES, and an authoring caller
 * supplies a render function for those addresses. This file stays ignorant of
 * the builder: it hands over a path and a value and takes back a node.
 */
export type BlockAuthoring = {
  field: (path: (string | number)[], value: InlineText) => ReactNode;
};

const AuthoringContext = createContext<BlockAuthoring | null>(null);

function Inline({ value, path }: { value: InlineText | undefined; path?: (string | number)[] }) {
  const surfaceHref = useSurfaceHref();
  const references = useContext(ReferenceContext);
  const authoring = useContext(AuthoringContext);
  // An optional leaf the author has not written yet is an empty field, not a
  // missing one — that is the whole reason the wrappers render regardless.
  if (authoring && path) return <>{authoring.field(path, value ?? "")}</>;
  if (value === undefined) return null;
  return (
    <>
      {toSpans(value).map((span, index) => {
        const internalReference = parseInternalReference(span.href);
        const target = internalReference && span.href ? references.targets.get(span.href) : undefined;
        const label = target?.label ?? span.text;
        let node: JSX.Element = <>{label}</>;
        if (span.bold) node = <strong>{node}</strong>;
        if (span.italic) node = <em>{node}</em>;
        if (target && references.courseSlug) {
          const fragment = target.kind === "block" ? `#block-${encodeURIComponent(target.blockId)}` : "";
          const path = `/${references.route}/${references.courseSlug}/${target.slug}${fragment}`;
          node = references.route === "learn" ? (
            <Link href={surfaceHref(path)}>{node}</Link>
          ) : (
            <Link href={path}>{node}</Link>
          );
        } else if (span.href && !internalReference) {
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
  courseSlug?: string;
  referenceTargets?: InternalReferenceTarget[];
  referenceRoute?: "learn" | "build";
  /** Present only in the builder: makes every addressed text leaf editable. */
  authoring?: BlockAuthoring | null;
};

export function BlockRenderer(props: BlockRendererProps) {
  const targets = new Map((props.referenceTargets ?? []).map((target) => [target.key, target]));
  return (
    <ReferenceContext.Provider
      value={{ courseSlug: props.courseSlug, route: props.referenceRoute ?? "learn", targets }}
    >
      <AuthoringContext.Provider value={props.authoring ?? null}>
        <BlockRendererBody {...props} />
      </AuthoringContext.Provider>
    </ReferenceContext.Provider>
  );
}

function BlockRendererBody({ block, checklist, onToggleChecklistItem, disabled }: BlockRendererProps) {
  /* An empty optional leaf renders nothing for a learner and must still render
     for an author — a title that only appears once it has been written is a
     title that can never be written. */
  const authoring = useContext(AuthoringContext);
  switch (block.type) {
    case "lesson_objective":
      return (
        <p className={styles.objective}>
          <Inline value={block.text} path={["text"]} />
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
              <Inline value={block.title} path={["title"]} />
            </h3>
            {block.text || authoring ? (
              <p className={styles.stepText}>
                <Inline value={block.text} path={["text"]} />
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
              <Inline value={block.title} path={["title"]} />
            </h3>
            {block.durationMin ? <span className={styles.outlineState}>{block.durationMin} хв</span> : null}
          </div>
          {block.text || authoring ? (
            <p className={styles.stepText}>
              <Inline value={block.text} path={["text"]} />
            </p>
          ) : null}
        </section>
      );

    case "checklist":
      return (
        <section className={styles.checklist}>
          {block.title || authoring ? (
            <h3 className={styles.checklistTitle}>
              <Inline value={block.title} path={["title"]} />
            </h3>
          ) : null}
          {block.items.map((item, index) => {
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
                  <Inline value={item.text} path={["items", index, "text"]} />
                </span>
              </label>
            );
          })}
        </section>
      );

    case "video":
      // Unlisted YouTube is the 2026-08-15 decision; the block stores
      // {provider, id}, so switching providers stays a data migration.
      //
      // `title` is the player's ACCESSIBLE NAME, not a caption — it goes in the
      // iframe's title attribute and is drawn nowhere. `durationMin` is the one
      // authored value here that does get drawn, beside the frame: until
      // 2026-08-21 it had no consumer at all, so the builder collected a number
      // that went to the database and died there.
      return (
        <figure className={styles.mediaFigure}>
          <iframe
            className={styles.media}
            src={`https://www.youtube-nocookie.com/embed/${block.videoId}`}
            title={block.title ? toSpans(block.title).map((span) => span.text).join("") : "Відео уроку"}
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
          {block.durationMin ? (
            <figcaption className={styles.caption}>{block.durationMin} хв</figcaption>
          ) : null}
        </figure>
      );

    case "image":
      return (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element -- authored content, arbitrary remote hosts */}
          <img className={styles.image} src={block.src} alt={block.alt} loading="lazy" />
          {block.caption || authoring ? (
            <figcaption className={styles.caption}>
              <Inline value={block.caption} path={["caption"]} />
            </figcaption>
          ) : null}
        </figure>
      );

    case "quote":
      return (
        <blockquote className={styles.quote}>
          <Inline value={block.text} path={["text"]} />
          {block.author ? <span className={styles.quoteAuthor}>{block.author}</span> : null}
        </blockquote>
      );

    case "code":
      return (
        <pre className={styles.codeBlock} data-language={block.language || undefined}>
          <code>{block.code}</code>
        </pre>
      );

    case "boundary_note":
      // Bounded health claims are a brand invariant — rendered, never hidden.
      return (
        <aside className={styles.boundary}>
          <Inline value={block.text} path={["text"]} />
        </aside>
      );

    case "faq_block":
      return (
        <section>
          {block.items.map((item, index) => (
            <details key={item.id} className={styles.faqItem} open={authoring ? true : undefined}>
              <summary className={styles.faqQuestion}>
                <Inline value={item.question} path={["items", index, "question"]} />
              </summary>
              <p className={styles.faqAnswer}>
                <Inline value={item.answer} path={["items", index, "answer"]} />
              </p>
            </details>
          ))}
        </section>
      );

    case "table":
      return (
        <figure className={styles.tableBlock}>
          {block.title || authoring ? (
            <figcaption className={styles.tableTitle}>
              <Inline value={block.title} path={["title"]} />
            </figcaption>
          ) : null}
          {/* The scroller is the element that scrolls, and it is focusable so a
              keyboard can reach a table wider than the column. Left to the page,
              a wide table widens the document and gives every screen on a phone
              a horizontal scroll. */}
          <div className={styles.tableScroll} tabIndex={0} role="group">
            <table className={styles.table}>
              {block.head ? (
                <thead>
                  <tr>
                    {block.head.map((cell, index) => (
                      <th key={index} scope="col">
                        <Inline value={cell} path={["head", index]} />
                      </th>
                    ))}
                  </tr>
                </thead>
              ) : null}
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex}>
                        <Inline value={cell} path={["rows", rowIndex, cellIndex]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </figure>
      );

    case "cta":
      return <CtaBlock href={block.href} label={block.label} text={block.text} authoring={authoring !== null} />;
  }
}
