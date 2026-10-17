"use client";

/**
 * Reactions under a post (G 2026-10-17, Threads-like): one button that carries
 * a pile of the post's three most used emoji and the total, gold when the
 * reader's own reaction is among them, and opens the whole hand-drawn set.
 *
 * THREE PER PERSON. A reader may leave up to three different emoji on one
 * post. In the set their own are pressed; at three the others are disabled
 * and the line says why — «Ваші 3 з 3 — зніміть одну, щоб обрати іншу». The
 * server holds the same rule (`reaction_limit`), so a second tab cannot get
 * round it; the card answers that refusal with the same line.
 *
 * A guest's press goes to the sign-in door; nothing is counted until there is
 * someone to count.
 */

import { useCallback, useId, useRef, useState } from "react";

import { Icon } from "@/components/Icon";
import { CW_EMOJI, CW_EMOJI_SPRITE_URL } from "@/lib/brand/emojiSet";
import { FEED_REACTIONS_PER_PERSON, FEED_TOP_REACTIONS, emojiName, type ReactionCount } from "@/lib/feed/model";

import { feedCopy } from "./copy";
import { useFloating } from "./useFloating";
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
  onGuest,
}: {
  reactions: ReactionCount[];
  busy: boolean;
  onToggle: (emoji: string) => void;
  /** Set for a guest: the button leads to sign-in instead of opening the set. */
  onGuest?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = useCallback(() => setOpen(false), []);
  useFloating(open, button, panel, close);

  const counted = reactions.filter((entry) => entry.count > 0);
  const total = counted.reduce((sum, entry) => sum + entry.count, 0);
  const mine = new Set(reactions.filter((entry) => entry.mine).map((entry) => entry.emoji as string));
  const full = mine.size >= FEED_REACTIONS_PER_PERSON;
  const pile = counted.slice(0, FEED_TOP_REACTIONS);
  /* One line per chip in the pile, with who pressed it (the mockup's «Вогонь ·
     Олена, Марко і ще 9»); the reader's own count as «ви». A browser hint is
     a mouse's affordance: on a phone the picker says the same in full. */
  const beyond = [...mine].filter((emoji) => !pile.some((entry) => entry.emoji === emoji));
  const tip = pile
    .map((entry) => feedCopy.reactionWho(emojiName(entry.emoji), entry.count, entry.who ?? [], entry.mine))
    .concat(beyond.length ? [`ваші також: ${beyond.map(emojiName).join(", ")}`] : [])
    .join("\n");

  return (
    <>
      <button
        ref={button}
        className={`${styles.act} ${styles.actReact}`}
        type="button"
        aria-pressed={mine.size > 0}
        aria-expanded={onGuest ? undefined : open}
        aria-haspopup={onGuest ? undefined : "dialog"}
        aria-label={feedCopy.reactionsTotal(total, mine.size)}
        title={tip || feedCopy.addReaction}
        onClick={() => (onGuest ? onGuest() : setOpen((current) => !current))}
      >
        {total > 0 ? (
          <>
            <span className={styles.emoPile} aria-hidden="true">
              {pile.map((entry) => (
                <Emoji key={entry.emoji} id={entry.emoji} className={styles.emoPileItem} />
              ))}
            </span>
            <span>{total}</span>
          </>
        ) : (
          <Icon name="smile" size={20} />
        )}
      </button>

      {open ? (
        <div ref={panel} className={`${styles.picker} cw-scroll`} role="dialog" aria-labelledby={titleId}>
          <div className={styles.pickerHead}>
            <p className={styles.pickerTitle} id={titleId}>
              {feedCopy.pickerTitle}
            </p>
            <button className={styles.pickerClose} type="button" aria-label={feedCopy.close} onClick={close}>
              <Icon name="close" size={20} />
            </button>
          </div>
          <p className={styles.pickerLimit} aria-live="polite">
            {full ? feedCopy.reactionLimit : feedCopy.reactionLimitHint(mine.size)}
          </p>
          {GROUPS.map((group) => (
            <div className={styles.pickerGroup} key={group}>
              <p className={styles.pickerLabel}>{group}</p>
              <div className={styles.pickerGrid}>
                {CW_EMOJI.filter((entry) => entry.group === group).map((entry) => {
                  const pressed = mine.has(entry.id);
                  return (
                    <button
                      key={entry.id}
                      className={styles.pickerItem}
                      type="button"
                      aria-pressed={pressed}
                      disabled={busy || (full && !pressed)}
                      onClick={() => onToggle(entry.id)}
                    >
                      <Emoji id={entry.id} className={styles.pickerEmoji} />
                      <span className={styles.pickerName}>{entry.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
