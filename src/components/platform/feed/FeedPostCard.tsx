"use client";

/**
 * One post in «Стрічка»: who wrote it and when (and with whom — «з …»), its
 * one to three topics, the photos, video or audio it carries, the words, the
 * block or programme, the action row and the comments (G 2026-10-17).
 *
 * THE WORDS are the markdown subset of `@/lib/feed/format`, drawn token by
 * token (`FeedBody`) — never as HTML. They fold after six lines in the feed
 * and four on the home rail; «Читати далі» appears only when lines are really
 * hidden, and «Згорнути» folds them again.
 *
 * MARKS. Selecting words in a post offers «Позначити» and «Нотатка», the lesson
 * reader's two acts; the mark lands in the reader's own «Мій журнал» signed
 * «Стрічка · <автор>». Offsets are counted in the text the reader sees (`feedBodyText`), and a mark
 * whose words the author has since changed is found again by its quote or
 * quietly not drawn — the journal still keeps it.
 */

import Link from "next/link";
import {
  Fragment,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ToastProvider";
import { AuthorPortrait } from "@/components/platform/AuthorPortrait";
import { COURSE_CATEGORY_LABELS } from "@/lib/platform/catalogVocabulary";
import { parseFeedBody } from "@/lib/feed/format";
import { EMPTY_FEED_MEDIA } from "@/lib/feed/media";
import { FEED_TOPICS_MAX, excerptOf, feedAuthorPath, feedPostPath, type ReactionCount } from "@/lib/feed/model";
import type { FeedPost } from "@/lib/feed/server";

import { feedCopy, relativeTime } from "./copy";
import { deleteMark, saveMark, toggleReaction, type FeedMarkView } from "./feedApi";
import { FeedActions } from "./FeedActions";
import { FeedAttachment } from "./FeedAttachment";
import { FeedBody, feedBodyText, type PlacedMark } from "./FeedBody";
import { FeedComments } from "./FeedComments";
import { FeedMedia } from "./FeedMedia";
import styles from "./Feed.module.css";

/* ─────────────── marks in the text ─────────────── */

type Placed = FeedMarkView & PlacedMark;

/**
 * Where each mark sits in the drawn text now; overlapping or lost marks are
 * left out. A mark is found by its offsets first, then by its quote — which
 * also finds marks made before 17.10, when offsets counted the raw body.
 */
function placeMarks(text: string, marks: FeedMarkView[]): Placed[] {
  const placed: Placed[] = [];
  for (const mark of marks) {
    let from = mark.start ?? -1;
    let to = mark.end ?? -1;
    if (!(from >= 0 && to > from && text.slice(from, to) === mark.quote)) {
      from = mark.quote ? text.indexOf(mark.quote) : -1;
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

/* ─────────────── the fold ─────────────── */

/**
 * Whether the clamped body actually hides lines. Measured, not guessed from
 * the length: six lines of a phone are a third of six lines of a desktop. The
 * button appears only when there is something under the fold.
 */
function useOverflow(ref: RefObject<HTMLElement | null>, clamped: boolean): boolean {
  const [over, setOver] = useState(false);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !clamped) return;
    const measure = () => setOver(node.scrollHeight - node.clientHeight > 2);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, clamped]);
  return over;
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
  variant = "feed",
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
  /**
   * `rail`: the home page's «Свіже від авторів» — the same card, folded after
   * four lines with a shorter photo, and the bubble leading to the post's page
   * instead of opening the thread in place.
   */
  variant?: "feed" | "rail";
}) {
  const toast = useToast();
  const card = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [reactions, setReactions] = useState<ReactionCount[]>(post.reactions);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(commentsOpen);
  const [count, setCount] = useState(post.commentCount);
  const [bar, setBar] = useState<Bar | null>(null);
  const [note, setNote] = useState("");
  // The post's own page shows it whole; the feed and the rail fold it.
  const [expanded, setExpanded] = useState(commentsOpen);
  const clamped = !expanded;
  const overflowing = useOverflow(bodyRef, clamped);

  const tokens = useMemo(() => parseFeedBody(post.body), [post.body]);
  const text = useMemo(() => feedBodyText(tokens), [tokens]);

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
    if (result.ok) {
      setReactions(result.data.reactions);
      return;
    }
    toast.error(result.code === "reaction_limit" ? feedCopy.reactionLimit : feedCopy.reactionFailed);
  }

  const placed = placeMarks(text, marks);

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

  function openMark(mark: PlacedMark, target: HTMLElement) {
    if (!card.current) return;
    const full = placed.find((entry) => entry.clientId === mark.clientId);
    if (!full) return;
    const rect = target.getBoundingClientRect();
    const box = card.current.getBoundingClientRect();
    setBar({
      kind: "existing",
      mark: full,
      top: rect.bottom - box.top + 8,
      left: Math.max(8, Math.min(rect.left - box.left, box.width - 240)),
    });
  }

  async function keep(withNote: string | null) {
    if (!bar || bar.kind !== "new") return;
    const quote = text.slice(bar.from, bar.to);
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
    const result = await saveMark({ ...mark, prefix: text.slice(Math.max(0, bar.from - 40), bar.from) });
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

  const Name = headingLevel === 2 ? "h2" : "h3";
  const when = post.publishedAt ?? post.createdAt;
  const topics = (post.topics?.length ? post.topics : [post.topic]).slice(0, FEED_TOPICS_MAX);

  return (
    <article className={styles.post} data-variant={variant} ref={card} aria-labelledby={`post-${post.id}-by`}>
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
            {post.tagged?.length ? (
              <span className={styles.withTag}>
                {` ${feedCopy.with} `}
                {post.tagged.map((author, index) => (
                  <Fragment key={author.id}>
                    {index > 0 ? ", " : null}
                    <Link href={feedAuthorPath(author.slug)}>{author.name}</Link>
                  </Fragment>
                ))}
              </span>
            ) : null}
          </Name>
          <p className={styles.when}>
            <Link href={feedPostPath(post.id)}>
              <time dateTime={when} suppressHydrationWarning>
                {relativeTime(when)}
              </time>
            </Link>
            {` · ${topics.map((topic) => COURSE_CATEGORY_LABELS[topic]).join(", ")}`}
          </p>
        </div>
      </div>

      {aside}

      <FeedMedia media={post.media ?? EMPTY_FEED_MEDIA} postId={post.id} />

      {tokens.length ? (
        <div className={styles.bodyFold}>
          <FeedBody
            ref={bodyRef}
            className={styles.body}
            clamped={clamped}
            tokens={tokens}
            marks={placed}
            onMark={openMark}
            onSelect={readSelection}
          />
          {overflowing ? (
            <button
              className={styles.moreText}
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? feedCopy.readLess : feedCopy.readMore}
            </button>
          ) : null}
        </div>
      ) : null}

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

      {post.attachment ? <FeedAttachment attachment={post.attachment} /> : null}

      {post.status === "published" ? (
        <FeedActions
          postId={post.id}
          shareText={`${post.author.name}: ${excerptOf(text, 120)}`}
          reactions={reactions}
          busy={busy}
          onReact={(emoji) => void react(emoji)}
          signedIn={signedIn}
          onGuest={goSignIn}
          commentCount={count}
          commentsOpen={open}
          onComments={variant === "rail" ? undefined : () => setOpen((current) => !current)}
          initiallySaved={post.saved ?? false}
        />
      ) : null}

      {open && post.status === "published" && variant === "feed" ? (
        <FeedComments postId={post.id} signedIn={signedIn} signInHref={signInHref} onCount={setCount} />
      ) : null}
    </article>
  );
}
