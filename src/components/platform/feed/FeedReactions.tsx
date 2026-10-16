"use client";

/**
 * The reactions under a post: the three most used, the reader's own, and «+»
 * for the whole hand-drawn set (G, 16.10: the colour set, names as they are).
 *
 * A guest's press goes to the sign-in door with this page as the way back;
 * nothing is counted until there is someone to count.
 */

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/Icon";
import { CW_EMOJI, CW_EMOJI_SPRITE_URL } from "@/lib/brand/emojiSet";
import { emojiName, visibleReactions, type ReactionCount } from "@/lib/feed/model";

import { feedCopy } from "./copy";
import styles from "./Feed.module.css";

export function Emoji({ id, className }: { id: string; className?: string }) {
  return (
    <svg className={className ?? styles.emoji} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <use href={`${CW_EMOJI_SPRITE_URL}#cwe-${id}`} />
    </svg>
  );
}

const GROUPS = [...new Set(CW_EMOJI.map((entry) => entry.group))];

export function FeedReactions({
  reactions,
  busy,
  onToggle,
}: {
  reactions: ReactionCount[];
  busy: boolean;
  /** The card decides what a press means: a toggle, or the door for a guest. */
  onToggle: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const mine = new Set(reactions.filter((entry) => entry.mine).map((entry) => entry.emoji as string));

  return (
    <div className={styles.reactions} role="group" aria-label={feedCopy.reactionsLabel} ref={root}>
      {visibleReactions(reactions).map((entry) => (
        <button
          key={entry.emoji}
          className={styles.reactionChip}
          type="button"
          aria-pressed={entry.mine}
          aria-label={`${emojiName(entry.emoji)}, ${entry.count}`}
          data-tip={emojiName(entry.emoji)}
          disabled={busy}
          onClick={() => onToggle(entry.emoji)}
        >
          <Emoji id={entry.emoji} />
          <span>{entry.count}</span>
        </button>
      ))}
      <button
        className={styles.addChip}
        type="button"
        aria-label={feedCopy.addReaction}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-tip={feedCopy.addReaction}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="plus" size={20} />
      </button>

      {open ? (
        <div className={styles.picker} role="dialog" aria-label={feedCopy.pickerTitle}>
          {GROUPS.map((group) => (
            <div className={styles.pickerGroup} key={group}>
              <p className={styles.pickerLabel}>{group}</p>
              <div className={styles.pickerGrid}>
                {CW_EMOJI.filter((entry) => entry.group === group).map((entry) => (
                  <button
                    key={entry.id}
                    className={styles.pickerItem}
                    type="button"
                    aria-pressed={mine.has(entry.id)}
                    disabled={busy}
                    onClick={() => {
                      setOpen(false);
                      onToggle(entry.id);
                    }}
                  >
                    <Emoji id={entry.id} className={styles.pickerEmoji} />
                    <span className={styles.pickerName}>{entry.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
