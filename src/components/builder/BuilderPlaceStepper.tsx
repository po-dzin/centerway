"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/Icon";
import { InteractionInkIcon } from "@/components/platform/InteractionInk";
import { plural } from "@/lib/plural";
import { BLOCKER_LABELS } from "./BuilderBlockers";
import { stepPlace, type BlockerPlace } from "./blockerPlaces";
import styles from "./Builder.module.css";

const places = (count: number) => plural(count, "місце", "місця", "місць");

/**
 * The strip that walks an author through what is left before publishing.
 *
 * The outline and the blocks already SHOW where the holes are; this is the
 * missing half — going from one to the next without returning to the list. →
 * is the next place in the course's own order, in another lesson if that is
 * where it is, and after the last it says so and starts over. The camera stays
 * where it is: moving the frame is the whole gesture, and a document that
 * scrolls under the author's hand is what they asked us not to do.
 */
export function BuilderPlaceStepper({
  places: all,
  from,
  currentKey,
  lessonId,
  onJump,
}: {
  places: BlockerPlace[];
  /** Where the author is now, in `placeOrder` terms; null when nowhere in particular. */
  from: number | null;
  /** The place the selected block belongs to, if it is one. */
  currentKey: string | null;
  lessonId: string;
  onJump: (place: BlockerPlace) => void;
}) {
  const [listOpen, setListOpen] = useState(false);
  const [note, setNote] = useState("");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listOpen) return;
    const away = (event: Event) => {
      if (!root.current?.contains(event.target as Node)) setListOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setListOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [listOpen]);

  if (all.length === 0) return null;

  const index = currentKey ? all.findIndex((place) => place.key === currentKey) : -1;
  const here = all.filter((place) => place.lessonId === lessonId);
  const hereIndex = index >= 0 ? here.findIndex((place) => place.key === currentKey) : -1;

  const step = (direction: 1 | -1) => {
    const next = stepPlace(all, from, direction);
    if (!next) return;
    setNote(
      next.wrapped
        ? direction > 0
          ? "Це було останнє місце, повертаємося до першого."
          : "Це було перше місце, переходимо до останнього."
        : "",
    );
    setListOpen(false);
    onJump(next.place);
  };

  return (
    <div className={styles.placeStepper} ref={root} role="group" aria-label="Місця перед публікацією">
      <div className={styles.placeStepperRow}>
        <span className={styles.flagDot} aria-hidden="true">
          {all.length}
        </span>
        <p className={styles.placeStepperText}>
          {here.length > 0
            ? `У цьому уроці: ${hereIndex >= 0 ? `${hereIndex + 1} з ${here.length}` : `${here.length} ${places(here.length)}`}`
            : "У цьому уроці все гаразд"}
        </p>
        <button
          className={styles.placeStepperCount}
          type="button"
          aria-expanded={listOpen}
          onClick={() => setListOpen((open) => !open)}
        >
          {index >= 0 ? `${index + 1} з ${all.length}` : `${all.length} ${places(all.length)}`}
          <Icon name="chevron-down" size={16} />
        </button>
        <button
          className={styles.placeStepperArrow}
          type="button"
          aria-label="Попереднє місце"
          title="Попереднє місце"
          data-cw-ink-control
          onClick={() => step(-1)}
        >
          <InteractionInkIcon>
            <Icon name="arrow-left" size={18} />
          </InteractionInkIcon>
        </button>
        <button
          className={styles.placeStepperArrow}
          type="button"
          aria-label="Наступне місце"
          title="Наступне місце"
          data-cw-ink-control
          onClick={() => step(1)}
        >
          <InteractionInkIcon>
            <Icon name="arrow-right" size={18} />
          </InteractionInkIcon>
        </button>
      </div>
      {listOpen ? (
        <ul className={styles.placeStepperList}>
          {all.map((place, position) => (
            <li key={place.key}>
              <button
                type="button"
                className={styles.placeStepperItem}
                aria-current={place.key === currentKey ? "true" : undefined}
                onClick={() => {
                  setListOpen(false);
                  setNote("");
                  onJump(place);
                }}
              >
                <span>
                  {position + 1}. {place.trail}
                </span>
                <small>{BLOCKER_LABELS[place.code] ?? place.code}</small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className={styles.placeStepperNote} role="status" aria-live="polite">
        {note}
      </p>
    </div>
  );
}
