"use client";

/**
 * A post's comments: one level of replies, the post's author marked «автор»,
 * and a held comment shown only to the person who wrote it (G, 16.10: no
 * manual review; only what the check stopped reaches the team).
 *
 * The post's author may hide any comment under their post; a writer may
 * delete their own. Nobody else sees either control.
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";

import { Icon } from "@/components/Icon";
import { AuthorPortrait } from "@/components/platform/AuthorPortrait";
import { useToast } from "@/components/ToastProvider";
import { FEED_COMMENT_MAX, feedPostPath } from "@/lib/feed/model";
import type { FeedComment } from "@/lib/feed/server";

import { commentsAfterRead } from "./commentsRead";
import { feedCopy, relativeTime } from "./copy";
import { addComment, fetchComments, removeComment, toggleCommentReaction } from "./feedApi";
import { FeedReactions } from "./FeedReactions";
import styles from "./Feed.module.css";

function CommentRow({
  comment,
  signedIn,
  onReply,
  onRemove,
  onReact,
  busy,
  signInHref,
  children,
}: {
  comment: FeedComment & { held?: boolean };
  signedIn: boolean;
  onReply: (comment: FeedComment) => void;
  onRemove: (comment: FeedComment) => void;
  onReact: (id: string, emoji: string) => void;
  busy: boolean;
  signInHref: string;
  children?: ReactNode;
}) {
  return (
    <li className={styles.comment}>
      {comment.who.href ? (
        <Link className={styles.commentFace} href={comment.who.href} tabIndex={-1} aria-hidden="true">
          <AuthorPortrait photo={comment.who.photo} size="xs" fallback={comment.who.initial} />
        </Link>
      ) : (
        <AuthorPortrait
          className={styles.commentFace}
          photo={comment.who.photo}
          size="xs"
          fallback={comment.who.initial}
        />
      )}
      <div className={styles.commentBody}>
        <p className={styles.commentHead}>
          {comment.who.href ? (
            <Link className={styles.commentName} href={comment.who.href}>
              {comment.who.name}
            </Link>
          ) : (
            <span className={styles.commentName}>{comment.who.name}</span>
          )}
          {comment.byAuthor ? <span className={styles.tag}>{feedCopy.byAuthor}</span> : null}
          <time className={styles.when} dateTime={comment.createdAt} suppressHydrationWarning>
            {relativeTime(comment.createdAt)}
          </time>
        </p>
        <p className={styles.commentText}>{comment.body}</p>
        {comment.held ? <p className={styles.commentHeld}>{feedCopy.commentHeld}</p> : null}
        <div className={styles.commentActions}>
          {!comment.held ? (
            <FeedReactions
              reactions={comment.reactions ?? []}
              busy={busy}
              onToggle={(emoji) => onReact(comment.id, emoji)}
              onGuest={
                signedIn
                  ? undefined
                  : () => {
                      window.location.href = signInHref;
                    }
              }
            />
          ) : null}
          {signedIn && !comment.parentId ? (
            <button
              className={styles.act}
              type="button"
              aria-label={feedCopy.reply}
              title={feedCopy.reply}
              onClick={() => onReply(comment)}
            >
              <Icon name="reply" size={20} />
            </button>
          ) : null}
          {comment.mine || comment.canHide ? (
            <button
              className={styles.act}
              data-tone="danger"
              type="button"
              aria-label={comment.mine ? feedCopy.remove : feedCopy.hide}
              title={comment.mine ? feedCopy.remove : feedCopy.hide}
              onClick={() => onRemove(comment)}
            >
              <Icon name={comment.mine ? "trash" : "unpublish"} size={20} />
            </button>
          ) : null}
        </div>
        {children}
      </div>
    </li>
  );
}

export function FeedComments({
  expanded = true,
  postId,
  signedIn,
  signInHref,
  onCount,
}: {
  expanded?: boolean;
  postId: string;
  signedIn: boolean;
  signInHref: string;
  /** The visible count changed: the card's «N коментарів» follows it. */
  onCount: (count: number) => void;
}) {
  const toast = useToast();
  const [comments, setComments] = useState<(FeedComment & { held?: boolean })[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<FeedComment | null>(null);
  const [sending, setSending] = useState(false);
  const [reacting, setReacting] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const commentsRequest = useRef(0);

  /* The field grows with its words instead of scrolling inside itself, and
     folds back to one line when it is emptied by sending. */
  useEffect(() => {
    const node = field.current;
    if (!node) return;
    node.style.blockSize = "auto";
    node.style.blockSize = `${node.scrollHeight}px`;
  }, [text]);

  const loadComments = useCallback(async () => {
    const request = ++commentsRequest.current;
    const result = await fetchComments(postId);
    if (request !== commentsRequest.current) return;
    setFailed(!result.ok);
    setComments((current) =>
      commentsAfterRead(current, result.ok ? { ok: true, comments: result.data.comments } : { ok: false }, true),
    );
  }, [postId]);

  useEffect(() => {
    const request = ++commentsRequest.current;
    void fetchComments(postId).then((result) => {
      if (request !== commentsRequest.current) return;
      setFailed(!result.ok);
      setComments((current) =>
        commentsAfterRead(current, result.ok ? { ok: true, comments: result.data.comments } : { ok: false }, signedIn),
      );
    });
    return () => {
      commentsRequest.current += 1;
    };
  }, [postId, signedIn]);

  /* A read started before a successful write can return an older snapshot
     afterwards. Invalidate it, then reconcile with the committed server state. */
  function refreshAfterMutation() {
    void loadComments();
  }

  async function react(id: string, emoji: string) {
    if (reacting) return;
    setReacting(id);
    const result = await toggleCommentReaction(id, emoji);
    setReacting(null);
    if (!result.ok) {
      toast.error(result.code === "reaction_limit" ? feedCopy.reactionLimit : feedCopy.reactionFailed);
      return;
    }
    setComments(
      (current) =>
        current?.map((comment) => (comment.id === id ? { ...comment, reactions: result.data.reactions } : comment)) ??
        null,
    );
    refreshAfterMutation();
  }

  useEffect(() => {
    if (comments !== null) onCount(comments.filter((comment) => !comment.held).length);
  }, [comments, onCount]);

  const top = (comments ?? []).filter((comment) => !comment.parentId);
  const repliesOf = (id: string) => (comments ?? []).filter((comment) => comment.parentId === id);

  /* Enter sends and Shift+Enter breaks the line where there is a keyboard to
     hold Shift on (a fine pointer); on a phone Enter is a new line and the
     button sends (G 2026-10-17). */
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    event.preventDefault();
    void send();
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const result = await addComment(postId, body, replyTo?.id ?? null);
    setSending(false);
    if (!result.ok) {
      toast.error(feedCopy.commentFailed);
      return;
    }
    const added = { ...result.data.comment, held: result.data.held };
    setComments((current) => {
      const next = [...(current ?? []), added];
      return next;
    });
    refreshAfterMutation();
    if (result.data.held) toast.info(feedCopy.commentHeldToast);
    setText("");
    setReplyTo(null);
  }

  async function remove(comment: FeedComment) {
    const result = await removeComment(comment.id);
    if (!result.ok) {
      toast.error(feedCopy.commentFailed);
      return;
    }
    setComments((current) => {
      // A removed comment takes its replies out of sight with it.
      const next = (current ?? []).filter((entry) => entry.id !== comment.id && entry.parentId !== comment.id);
      return next;
    });
    refreshAfterMutation();
  }

  return (
    <section data-no-open className={styles.comments} aria-label="Коментарі">
      {comments === null ? (
        failed ? (
          <p className={styles.guestLine}>
            {feedCopy.commentsLoadFailed}{" "}
            <button className={styles.commentAction} type="button" onClick={() => void loadComments()}>
              {feedCopy.retry}
            </button>
          </p>
        ) : (
          <p className={styles.guestLine}>{feedCopy.loading}</p>
        )
      ) : null}
      {top.length > 0 ? (
        <ul className={styles.commentList}>
          {(expanded ? top : top.slice(-2)).map((comment) => {
            const replies = expanded ? repliesOf(comment.id) : [];
            return (
              <CommentRow
                key={comment.id}
                comment={comment}
                signedIn={signedIn}
                onReply={(comment) => {
                  setReplyTo(comment);
                  field.current?.focus({ preventScroll: true });
                }}
                onRemove={remove}
                onReact={(id, emoji) => void react(id, emoji)}
                busy={reacting !== null}
                signInHref={signInHref}
              >
                {replies.length > 0 ? (
                  <ul className={styles.replies}>
                    {replies.map((reply) => (
                      <CommentRow
                        key={reply.id}
                        comment={reply}
                        signedIn={signedIn}
                        onReply={(comment) => {
                          setReplyTo(comment);
                          field.current?.focus({ preventScroll: true });
                        }}
                        onRemove={remove}
                        onReact={(id, emoji) => void react(id, emoji)}
                        busy={reacting !== null}
                        signInHref={signInHref}
                      />
                    ))}
                  </ul>
                ) : null}
              </CommentRow>
            );
          })}
        </ul>
      ) : null}

      {!expanded && (comments?.length ?? 0) > 0 ? (
        <Link className="cw-link-rule" href={feedPostPath(postId)}>
          {feedCopy.allComments}
        </Link>
      ) : null}
      {signedIn ? (
        <form onSubmit={send}>
          {replyTo ? (
            <p className={styles.replyingTo}>
              {feedCopy.replyingTo} {replyTo.who.name}
              <button
                className={styles.act}
                type="button"
                aria-label={feedCopy.cancel}
                title={feedCopy.cancel}
                onClick={() => setReplyTo(null)}
              >
                <Icon name="close" size={20} />
              </button>
            </p>
          ) : null}
          <div className={styles.writeRow}>
            <textarea
              ref={field}
              aria-label={replyTo ? feedCopy.writeReply : feedCopy.writeComment}
              className={styles.writeField}
              rows={1}
              maxLength={FEED_COMMENT_MAX}
              value={text}
              placeholder={replyTo ? feedCopy.writeReply : feedCopy.writeComment}
              enterKeyHint="send"
              onKeyDown={onKeyDown}
              onChange={(event) => setText(event.target.value)}
            />
            <button
              className={styles.sendButton}
              type="submit"
              disabled={sending || !text.trim()}
              aria-label={feedCopy.send}
              title={feedCopy.send}
            >
              <Icon name="arrow-up" size={20} />
            </button>
          </div>
        </form>
      ) : (
        <p className={styles.guestLine}>
          <Link className="cw-link-rule" href={signInHref}>
            {feedCopy.signIn}
          </Link>
          {", щоб коментувати."}
        </p>
      )}
    </section>
  );
}
