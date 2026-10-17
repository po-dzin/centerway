"use client";

/**
 * One post in «Стрічка»: who wrote it and when, the words, the block or
 * programme it carries, the reactions and the comments.
 *
 * MARKS. Selecting words in a post offers «Позначити» and «Нотатка», the lesson
 * reader's two acts; the mark lands in the reader's own «Мій журнал» signed
 * «Стрічка · <автор>». Offsets are counted in the post's plain text, and a mark
 * whose words the author has since changed is found again by its quote or
 * quietly not drawn — the journal still keeps it.
 */

import Link from "next/link";
import { useCallback, useRef, useState, type ReactNode } from "react";

import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ToastProvider";
import { AuthorPortrait } from "@/components/platform/AuthorPortrait";
import { plural } from "@/lib/plural";
import { COURSE_CATEGORY_LABELS } from "@/lib/platform/catalogVocabulary";
import { feedAuthorPath, feedPostPath, type ReactionCount } from "@/lib/feed/model";
import type { FeedAttachment, FeedPost } from "@/lib/feed/server";

import { feedCopy, relativeTime } from "./copy";
import { deleteMark, saveMark, toggleReaction, type FeedMarkView } from "./feedApi";
import { FeedComments } from "./FeedComments";
import { FeedReactions } from "./FeedReactions";
import styles from "./Feed.module.css";

/* ─────────────── marks in the text ─────────────── */

type Placed = FeedMarkView & { from: number; to: number };

/** Where each mark sits in the body now; overlapping or lost marks are left out. */
function placeMarks(body: string, marks: FeedMarkView[]): Placed[] {
  const placed: Placed[] = [];
  for (const mark of marks) {
    let from = mark.start ?? -1;
    let to = mark.end ?? -1;
    if (!(from >= 0 && to > from && body.slice(from, to) === mark.quote)) {
      from = mark.quote ? body.indexOf(mark.quote) : -1;
      to = from >= 0 && mark.quote ? from + mark.quote.length : -1;
    }
    if (from >= 0 && to > from) placed.push({ ...mark, from, to });
  }
  placed.sort((a, b) => a.from - b.from);
  return placed.filter((mark, index) => index === 0 || mark.from >= (placed[index - 1]?.to ?? 0));
}

function textOffset(root: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, offset);
  return range.toString().length;
}

function newClientId(): string {
  return `fm-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

type Bar =
  | { kind: "new"; from: number; to: number; top: number; left: number; writing: boolean }
  | { kind: "existing"; mark: Placed; top: number; left: number };

/* ─────────────── the attachment ─────────────── */

function attachmentIcon(attachment: FeedAttachment) {
  if (attachment.kind === "program") return "guide" as const;
  if (attachment.media === "video") return "play" as const;
  if (attachment.media === "image") return "eye" as const;
  return "document" as const;
}

function Attachment({ attachment }: { attachment: FeedAttachment }) {
  const extra = [
    attachment.media === "video" ? feedCopy.video : attachment.media === "image" ? feedCopy.image : null,
    attachment.durationMin ? `${attachment.durationMin} ${feedCopy.minutes}` : null,
  ].filter(Boolean);
  return (
    <div className={styles.attach}>
      <span className={styles.attachIcon} aria-hidden="true">
        <Icon name={attachmentIcon(attachment)} size={20} />
      </span>
      <div className={styles.attachBody}>
        <p className={styles.attachTitle}>{attachment.title}</p>
        <p className={styles.attachMeta}>{[attachment.meta, ...extra].join(" · ")}</p>
        {attachment.text ? <p className={styles.attachText}>{attachment.text}</p> : null}
        {attachment.href ? (
          <Link className={`cw-link-rule ${styles.attachGo}`} href={attachment.href}>
            {feedCopy.openProgram}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/* ─────────────── the card ─────────────── */

export function FeedPostCard({
  post,
  signedIn,
  signInHref,
  marks = [],
  onMarks,
  commentsOpen = false,
  headingLevel = 2,
  aside,
}: {
  post: FeedPost;
  signedIn: boolean;
  signInHref: string;
  marks?: FeedMarkView[];
  onMarks?: (postId: string, marks: FeedMarkView[]) => void;
  /** The post's own page opens its thread; the feed keeps it folded. */
  commentsOpen?: boolean;
  headingLevel?: 2 | 3;
  /** Extra lines under the byline — the workshop's state and reasons. */
  aside?: ReactNode;
}) {
  const toast = useToast();
  const card = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const [reactions, setReactions] = useState<ReactionCount[]>(post.reactions);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(commentsOpen);
  const [count, setCount] = useState(post.commentCount);
  const [bar, setBar] = useState<Bar | null>(null);
  const [note, setNote] = useState("");

  const goSignIn = useCallback(() => {
    window.location.assign(signInHref);
  }, [signInHref]);

  async function react(emoji: string) {
    if (!signedIn) {
      goSignIn();
      return;
    }
    setBusy(true);
    const result = await toggleReaction(post.id, emoji);
    setBusy(false);
    if (result.ok) setReactions(result.data.reactions);
  }

  const placed = placeMarks(post.body, marks);

  function readSelection() {
    if (!signedIn || !bodyRef.current || !card.current) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (!bodyRef.current.contains(range.commonAncestorContainer)) return;
    const from = textOffset(bodyRef.current, range.startContainer, range.startOffset);
    const to = textOffset(bodyRef.current, range.endContainer, range.endOffset);
    if (to - from < 2) return;
    const rect = range.getBoundingClientRect();
    const box = card.current.getBoundingClientRect();
    setNote("");
    setBar({
      kind: "new",
      from,
      to,
      top: rect.bottom - box.top + 8,
      left: Math.max(8, Math.min(rect.left - box.left, box.width - 240)),
      writing: false,
    });
  }

  function openMark(mark: Placed, target: HTMLElement) {
    if (!card.current) return;
    const rect = target.getBoundingClientRect();
    const box = card.current.getBoundingClientRect();
    setBar({
      kind: "existing",
      mark,
      top: rect.bottom - box.top + 8,
      left: Math.max(8, Math.min(rect.left - box.left, box.width - 240)),
    });
  }

  async function keep(withNote: string | null) {
    if (!bar || bar.kind !== "new") return;
    const quote = post.body.slice(bar.from, bar.to);
    const mark: FeedMarkView = {
      clientId: newClientId(),
      postId: post.id,
      quote,
      start: bar.from,
      end: bar.to,
      note: withNote,
    };
    setBar(null);
    window.getSelection()?.removeAllRanges();
    const result = await saveMark({ ...mark, prefix: post.body.slice(Math.max(0, bar.from - 40), bar.from) });
    if (!result.ok) {
      toast.error(feedCopy.markFailed);
      return;
    }
    onMarks?.(post.id, [...marks, result.data.mark]);
    toast.success(feedCopy.markSaved);
  }

  async function drop(mark: Placed) {
    setBar(null);
    const result = await deleteMark(mark.clientId);
    if (!result.ok) {
      toast.error(feedCopy.markFailed);
      return;
    }
    onMarks?.(
      post.id,
      marks.filter((entry) => entry.clientId !== mark.clientId),
    );
  }

  const segments: ReactNode[] = [];
  let cursor = 0;
  for (const mark of placed) {
    if (mark.from > cursor) segments.push(post.body.slice(cursor, mark.from));
    segments.push(
      <mark
        key={mark.clientId}
        className={styles.mark}
        data-note={mark.note ? "" : undefined}
        title={mark.note ?? undefined}
        onClick={(event) => openMark(mark, event.currentTarget)}
      >
        {post.body.slice(mark.from, mark.to)}
      </mark>,
    );
    cursor = mark.to;
  }
  if (cursor < post.body.length) segments.push(post.body.slice(cursor));

  const Name = headingLevel === 2 ? "h2" : "h3";
  const when = post.publishedAt ?? post.createdAt;

  return (
    <article className={styles.post} ref={card} aria-labelledby={`post-${post.id}-by`}>
      <div className={styles.byline}>
        {/* The face is a second way to the same profile as the name, so it
            stays out of the tab order and out of the accessibility tree. */}
        <Link className={styles.face} href={feedAuthorPath(post.author.slug)} tabIndex={-1} aria-hidden="true">
          <AuthorPortrait
            photo={post.author.photo}
            size="sm"
            fallback={post.author.name.trim().charAt(0).toUpperCase()}
          />
        </Link>
        <div className={styles.who}>
          <Name className={styles.whoName} id={`post-${post.id}-by`}>
            <Link href={feedAuthorPath(post.author.slug)}>{post.author.name}</Link>
          </Name>
          <p className={styles.when}>
            <Link href={feedPostPath(post.id)}>
              <time dateTime={when} suppressHydrationWarning>
                {relativeTime(when)}
              </time>
            </Link>
            {` · ${COURSE_CATEGORY_LABELS[post.topic]}`}
          </p>
        </div>
      </div>

      {aside}

      <p className={styles.body} ref={bodyRef} onMouseUp={readSelection} onKeyUp={readSelection}>
        {segments}
      </p>

      {bar ? (
        <div
          className={styles.selectionBar}
          style={{ top: bar.top, left: bar.left }}
          role="dialog"
          aria-label="Позначка"
        >
          {bar.kind === "new" && !bar.writing ? (
            <div className={styles.selectionRow}>
              <button className={styles.selectionAction} type="button" onClick={() => void keep(null)}>
                <Icon name="bookmark" size={18} />
                {feedCopy.markAdd}
              </button>
              <button
                className={styles.selectionAction}
                type="button"
                onClick={() => setBar({ ...bar, writing: true })}
              >
                <Icon name="edit" size={18} />
                {feedCopy.markNote}
              </button>
              <button
                className={styles.selectionAction}
                type="button"
                aria-label={feedCopy.close}
                onClick={() => setBar(null)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          ) : null}
          {bar.kind === "new" && bar.writing ? (
            <>
              <textarea
                className={styles.noteField}
                aria-label={feedCopy.markNote}
                placeholder={feedCopy.notePlaceholder}
                value={note}
                maxLength={2000}
                autoFocus
                onChange={(event) => setNote(event.target.value)}
              />
              <div className={styles.selectionRow}>
                <button className={styles.selectionAction} type="button" onClick={() => void keep(note.trim() || null)}>
                  {feedCopy.markSave}
                </button>
                <button className={styles.selectionAction} type="button" onClick={() => setBar(null)}>
                  {feedCopy.cancel}
                </button>
              </div>
            </>
          ) : null}
          {bar.kind === "existing" ? (
            <>
              {bar.mark.note ? <p className={styles.commentText}>{bar.mark.note}</p> : null}
              <div className={styles.selectionRow}>
                <button className={styles.selectionAction} type="button" onClick={() => void drop(bar.mark)}>
                  {feedCopy.markRemove}
                </button>
                <button
                  className={styles.selectionAction}
                  type="button"
                  aria-label={feedCopy.close}
                  onClick={() => setBar(null)}
                >
                  <Icon name="close" size={18} />
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {post.attachment ? <Attachment attachment={post.attachment} /> : null}

      {post.status === "published" ? (
        <div className={styles.social}>
          <FeedReactions reactions={reactions} busy={busy} onToggle={(emoji) => void react(emoji)} />
          <button
            className={styles.countLink}
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          >
            {open
              ? feedCopy.commentsHide
              : count > 0
                ? `${count} ${plural(count, ...feedCopy.comments)}`
                : feedCopy.commentsNone}
          </button>
        </div>
      ) : null}

      {open && post.status === "published" ? (
        <FeedComments postId={post.id} signedIn={signedIn} signInHref={signInHref} onCount={setCount} />
      ) : null}
    </article>
  );
}
