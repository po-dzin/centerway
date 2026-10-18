"use client";

/**
 * The row under a post (G 2026-10-17, as in Threads): reactions · comments ·
 * «Зберегти» · «Поділитися». Icons with counts, no words; every control says
 * what it does to a screen reader and on hover.
 *
 * - «Зберегти» puts the post in the reader's «Мій журнал» (an entry «Стрічка ·
 *   <автор>»), and a second press takes it out.
 * - «Поділитися»: copy the post's own address, send it to Telegram, or — where
 *   the device has one — the system share sheet. The last is offered only
 *   after mount, when it is known whether `navigator.share` exists.
 */

import Link from "next/link";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";

import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ToastProvider";
import { feedPostPath, type ReactionCount } from "@/lib/feed/model";

import { feedCopy } from "./copy";
import { recordShare, savePost, unsavePost, type ShareChannel } from "./feedApi";
import { FeedReactions } from "./FeedReactions";
import { useFloating } from "./useFloating";
import styles from "./Feed.module.css";

const NO_SUBSCRIBE = () => () => {};

/**
 * «Поділитися». The number beside the arrow is how many people shared the
 * post — one per account however often they do (G 17.10). A signed-in
 * reader's first share moves it at once; a guest shares without counting.
 */
function ShareMenu({
  postId,
  text,
  count: initialCount,
  shared: initiallyShared,
  signedIn,
}: {
  postId: string;
  text: string;
  count: number;
  shared: boolean;
  signedIn: boolean;
}) {
  const [count, setCount] = useState(initialCount);
  const [shared, setShared] = useState(initiallyShared);
  const toast = useToast();
  const [open, setOpen] = useState(false);
  // The system sheet exists only in some browsers; known after hydration.
  const canShare = useSyncExternalStore(
    NO_SUBSCRIBE,
    () => typeof navigator.share === "function",
    () => false,
  );
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useFloating(open, button, panel, close, "end");

  const url = (channel: ShareChannel) => {
    countShare(channel);
    return new URL(feedPostPath(postId), window.location.origin).toString();
  };

  /* Counted before the browser hands the link on: the press is the share. */
  function countShare(channel: ShareChannel) {
    if (!signedIn || shared) return;
    setShared(true);
    setCount((current) => current + 1);
    void recordShare(postId, channel).then((result) => {
      if (result.ok) return;
      setShared(false);
      setCount((current) => Math.max(0, current - 1));
    });
  }

  async function copy() {
    close();
    try {
      await navigator.clipboard.writeText(url("link"));
      toast.success(feedCopy.shareCopied);
    } catch {
      toast.error(feedCopy.shareFailed);
    }
  }

  function telegram() {
    close();
    const href = `https://t.me/share/url?url=${encodeURIComponent(url("telegram"))}&text=${encodeURIComponent(text)}`;
    window.open(href, "_blank", "noopener");
  }

  async function system() {
    close();
    try {
      await navigator.share({ url: url("system"), text });
    } catch {
      /* The reader closed the sheet: nothing to say. */
    }
  }

  return (
    <>
      <button
        ref={button}
        className={styles.act}
        type="button"
        aria-label={feedCopy.shareLabel(count)}
        title={feedCopy.share}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="share" size={20} />
        {count > 0 ? <span>{count}</span> : null}
      </button>
      {open ? (
        <div ref={panel} className={styles.menu} role="menu" aria-label={feedCopy.share}>
          <button className={styles.menuItem} type="button" role="menuitem" onClick={() => void copy()}>
            <Icon name="link" size={20} />
            {feedCopy.shareCopy}
          </button>
          <button className={styles.menuItem} type="button" role="menuitem" onClick={telegram}>
            <Icon name="telegram" size={20} />
            {feedCopy.shareTelegram}
          </button>
          {canShare ? (
            <button className={styles.menuItem} type="button" role="menuitem" onClick={() => void system()}>
              <Icon name="export" size={20} />
              {feedCopy.shareMore}
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function FeedActions({
  postId,
  shareText,
  reactions,
  busy,
  onReact,
  signedIn,
  onGuest,
  commentCount,
  commentsOpen,
  onComments,
  initiallySaved,
  initialSaveCount,
  shareCount,
  initiallyShared,
}: {
  postId: string;
  shareText: string;
  reactions: ReactionCount[];
  busy: boolean;
  onReact: (emoji: string) => void;
  signedIn: boolean;
  onGuest: () => void;
  commentCount: number;
  commentsOpen: boolean;
  /** Absent in the feed and on the home rail: there the bubble leads to the post's own page, where the thread is. */
  onComments?: () => void;
  initiallySaved: boolean;
  /** Everyone's saves; the reader's own press moves it at once. */
  initialSaveCount: number;
  /** People who shared the post, one per account. */
  shareCount: number;
  initiallyShared: boolean;
}) {
  const toast = useToast();
  const [saved, setSaved] = useState(initiallySaved);
  const [saveCount, setSaveCount] = useState(initialSaveCount);
  const [saving, setSaving] = useState(false);

  async function toggleSave() {
    if (!signedIn) {
      onGuest();
      return;
    }
    if (saving) return;
    const next = !saved;
    setSaving(true);
    setSaved(next);
    setSaveCount((current) => Math.max(0, current + (next ? 1 : -1)));
    const result = next ? await savePost(postId) : await unsavePost(postId);
    setSaving(false);
    if (!result.ok) {
      setSaved(!next);
      setSaveCount((current) => Math.max(0, current + (next ? -1 : 1)));
      toast.error(feedCopy.saveFailed);
      return;
    }
    if (next) toast.success(feedCopy.saved);
    else toast.info(feedCopy.unsaved);
  }

  const comments = (
    <>
      <Icon name="comment" size={20} />
      {commentCount > 0 ? <span>{commentCount}</span> : null}
    </>
  );

  return (
    <div className={styles.actRow}>
      <FeedReactions reactions={reactions} busy={busy} onToggle={onReact} onGuest={signedIn ? undefined : onGuest} />
      {onComments ? (
        <button
          className={styles.act}
          type="button"
          aria-expanded={commentsOpen}
          aria-label={commentsOpen ? feedCopy.commentsHide : feedCopy.commentsLabel(commentCount)}
          title={commentsOpen ? feedCopy.commentsHide : feedCopy.commentsNone}
          onClick={onComments}
        >
          {comments}
        </button>
      ) : (
        <Link
          className={styles.act}
          href={feedPostPath(postId)}
          aria-label={feedCopy.commentsLabel(commentCount)}
          title={feedCopy.commentsNone}
        >
          {comments}
        </Link>
      )}
      <button
        className={`${styles.act} ${styles.actSave}`}
        type="button"
        aria-pressed={saved}
        aria-label={feedCopy.saveLabel(saveCount)}
        title={saved ? feedCopy.saved : feedCopy.save}
        onClick={() => void toggleSave()}
      >
        <Icon name={saved ? "bookmark-marked" : "bookmark"} size={20} />
        {saveCount > 0 ? <span>{saveCount}</span> : null}
      </button>
      <ShareMenu postId={postId} text={shareText} count={shareCount} shared={initiallyShared} signedIn={signedIn} />
    </div>
  );
}
