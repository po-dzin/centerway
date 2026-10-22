"use client";

/**
 * The composer's small menus: the topics under the author's name and the
 * «з …» authors. Both are the shelf's popover recipe (`ShelfFilter.module.css`)
 * — the same rows, ticks and ink the feed's own filter draws — and both scroll
 * with the DS bar (`cw-scroll`) when the list is taller than the room.
 *
 * WHY `position: fixed`. The menus live inside the dialog's scrolling body, and
 * a scroller clips anything absolutely positioned inside it: a topic list that
 * opens under the name was cut at the field's edge. A fixed box escapes the
 * scroller (the dialog has no transform), so it is placed from the trigger's
 * own rectangle when it opens and follows it on scroll and resize — below the
 * trigger when there is room, above it when there is not.
 */

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { Icon } from "@/components/Icon";
import { AuthorPortrait } from "@/components/platform/AuthorPortrait";
import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import { FEED_TOPIC_ICONS, FEED_TOPIC_LABELS } from "@/lib/feed/vocabulary";
import { FEED_TOPICS, FEED_TOPICS_MAX, type FeedTopic } from "@/lib/feed/model";
import { FEED_TAGS_MAX } from "@/lib/feed/media";
import type { FeedAuthor } from "@/lib/feed/server";

import { composerCopy } from "./composerCopy";
import styles from "./FeedComposer.module.css";

const GAP = 4;
const EDGE = 12;

/**
 * A menu anchored to a trigger. `open` lives with the caller so the dialog can
 * close an open menu on Escape before it closes itself.
 */
export function ComposerPopover({
  open,
  onClose,
  anchor,
  label,
  width = 304,
  role = "group",
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchor: React.RefObject<HTMLElement | null>;
  label: string;
  width?: number;
  role?: "group" | "menu";
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <AnchoredBox onClose={onClose} anchor={anchor} label={label} width={width} role={role}>
      {children}
    </AnchoredBox>
  );
}

/**
 * Mounted only while open. The place is written straight onto the element —
 * it is a property of the viewport, read on every scroll, and keeping it in
 * React state would re-render the menu for each pixel the dialog scrolls.
 */
function AnchoredBox({
  onClose,
  anchor,
  label,
  width,
  role,
  children,
}: {
  onClose: () => void;
  anchor: React.RefObject<HTMLElement | null>;
  label: string;
  width: number;
  role: "group" | "menu";
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const place = () => {
      const trigger = anchor.current;
      const element = box.current;
      if (!trigger || !element) return;
      const rect = trigger.getBoundingClientRect();
      const viewW = window.innerWidth;
      const viewH = window.innerHeight;
      const w = Math.min(width, viewW - EDGE * 2);
      const left = Math.min(Math.max(EDGE, rect.left), viewW - EDGE - w);
      const below = viewH - rect.bottom - GAP - EDGE;
      const above = rect.top - GAP - EDGE;
      const down = below >= 240 || below >= above;
      element.style.left = `${left}px`;
      element.style.width = `${w}px`;
      element.style.top = down ? `${rect.bottom + GAP}px` : "auto";
      element.style.bottom = down ? "auto" : `${viewH - rect.top + GAP}px`;
      element.style.maxHeight = `${Math.max(160, down ? below : above)}px`;
    };
    place();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (box.current?.contains(target) || anchor.current?.contains(target)) return;
      onClose();
    };
    // Capture: the dialog's body scrolls, and its scroll does not bubble to window.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [anchor, width, onClose]);

  return (
    <div ref={box} className={`${styles.popover} cw-scroll`} role={role} aria-label={label}>
      {children}
    </div>
  );
}

function Check() {
  return (
    <span className={styles.checkbox} aria-hidden="true">
      <Icon name="check" size={14} />
    </span>
  );
}

/* ─────────────────────────── topics ─────────────────────────── */

export function TopicMenu({
  topics,
  onChange,
  open,
  onOpenChange,
}: {
  topics: FeedTopic[];
  onChange: (next: FeedTopic[]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const full = topics.length >= FEED_TOPICS_MAX;
  const summary = topics.length ? topics.map((topic) => FEED_TOPIC_LABELS[topic]).join(", ") : composerCopy.topics;

  return (
    <>
      <button
        ref={trigger}
        className={styles.topicTrigger}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        data-empty={topics.length === 0 || undefined}
        onClick={() => onOpenChange(!open)}
      >
        {topics.length ? (
          <span className={styles.topicIcons} aria-hidden="true">
            {topics.map((topic) => (
              <Icon key={topic} name={FEED_TOPIC_ICONS[topic]} size={20} />
            ))}
          </span>
        ) : null}
        <span className={styles.topicSummary}>{summary}</span>
        <Icon name="chevron-down" size={20} />
      </button>
      <ComposerPopover
        open={open}
        onClose={() => onOpenChange(false)}
        anchor={trigger}
        label={composerCopy.topicsLabel}
      >
        <p className={styles.popoverNote}>{full ? composerCopy.topicsFull : composerCopy.topicsHint}</p>
        <div className={styles.options}>
          {FEED_TOPICS.map((topic) => {
            const checked = topics.includes(topic);
            const disabled = !checked && full;
            return (
              <label key={topic} className={styles.option} data-disabled={disabled || undefined}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onChange(checked ? topics.filter((entry) => entry !== topic) : [...topics, topic])}
                />
                <Check />
                <span className={styles.optionText}>
                  <Icon name={FEED_TOPIC_ICONS[topic]} size={20} />
                  <InteractionInkLabel variant="menu" active={checked}>
                    {FEED_TOPIC_LABELS[topic]}
                  </InteractionInkLabel>
                </span>
              </label>
            );
          })}
        </div>
      </ComposerPopover>
    </>
  );
}

/* ─────────────────────────── tagged authors ─────────────────────────── */

export function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

/** The «з …» row above the text: the tagged authors, each removable, and «+ автора». */
export function TagRow({
  taggable,
  tagged,
  onChange,
  open,
  onOpenChange,
  anchor,
}: {
  taggable: FeedAuthor[];
  tagged: string[];
  onChange: (next: string[]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The tools row's «user» button; the menu opens from there when nobody is tagged yet. */
  anchor: React.RefObject<HTMLElement | null>;
}) {
  const add = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState("");
  const findId = useId();
  const chosen = tagged.flatMap((id) => taggable.filter((author) => author.id === id));
  const full = tagged.length >= FEED_TAGS_MAX;
  const needle = query.trim().toLowerCase();
  const shown = needle ? taggable.filter((author) => author.name.toLowerCase().includes(needle)) : taggable;

  return (
    <>
      {chosen.length ? (
        <div className={styles.tagRow} aria-label={composerCopy.tagLabel}>
          <span className={styles.muted}>{composerCopy.tagWith}</span>
          {chosen.map((author) => (
            <span key={author.id} className={styles.tagChip}>
              {author.name}
              <button
                className={styles.chipRemoveAction}
                type="button"
                aria-label={composerCopy.tagRemove(author.name)}
                onClick={() => onChange(tagged.filter((id) => id !== author.id))}
              >
                <Icon name="close" size={20} />
              </button>
            </span>
          ))}
          {full ? null : (
            <button
              ref={add}
              className={styles.tagAddAction}
              type="button"
              aria-expanded={open}
              onClick={() => onOpenChange(!open)}
            >
              <Icon name="plus" size={20} />
              {composerCopy.tagAdd}
            </button>
          )}
        </div>
      ) : null}
      <ComposerPopover
        open={open}
        onClose={() => {
          onOpenChange(false);
          setQuery("");
        }}
        anchor={chosen.length && !full ? add : anchor}
        label={composerCopy.tagLabel}
      >
        {taggable.length > 6 ? (
          <label className={styles.find} htmlFor={findId}>
            <Icon name="lens" size={20} />
            <input
              id={findId}
              className={styles.findInput}
              type="search"
              value={query}
              placeholder={composerCopy.tagFind}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        ) : null}
        <div className={styles.options}>
          {shown.map((author) => {
            const checked = tagged.includes(author.id);
            const disabled = !checked && full;
            return (
              <label key={author.id} className={styles.option} data-disabled={disabled || undefined}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onChange(checked ? tagged.filter((id) => id !== author.id) : [...tagged, author.id])}
                />
                <Check />
                <span className={styles.optionText}>
                  <AuthorPortrait photo={author.photo} size="xs" fallback={initialOf(author.name)} />
                  <InteractionInkLabel variant="menu" active={checked}>
                    {author.name}
                  </InteractionInkLabel>
                </span>
              </label>
            );
          })}
          {shown.length === 0 ? <p className={styles.popoverNote}>{composerCopy.tagNone}</p> : null}
        </div>
        <p className={styles.popoverNote}>{composerCopy.tagNote}</p>
      </ComposerPopover>
    </>
  );
}
