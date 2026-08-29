"use client";

import { Icon } from "@/components/Icon";

import type { CourseHistory } from "./useCourseHistory";
import styles from "./Builder.module.css";

/**
 * The undo pair, as it appears in the save bar.
 *
 * VISIBLE, NOT ONLY BOUND. ⌘Z is the fast path and the one an author will
 * actually use, but a shortcut nobody is told about is a feature that does not
 * exist. The buttons are here so the capability is on screen — and so the
 * disabled state can say the honest thing: nothing left to take back.
 *
 * It sits in the save bar rather than in the header because undo belongs with
 * the other statements about unsaved work: what changed, take it back, write it
 * down. Putting it in the chrome would have separated the two halves of one
 * decision.
 */
export function BuilderHistory({ history, disabled }: { history: CourseHistory; disabled?: boolean }) {
  return (
    <div className={styles.historyPair}>
      <button
        className={styles.historyButton}
        type="button"
        onClick={history.undo}
        disabled={disabled || !history.canUndo}
        aria-label="Скасувати останню зміну"
        title="Скасувати — ⌘Z"
      >
        <Icon name="undo" size={18} />
      </button>
      <button
        className={styles.historyButton}
        type="button"
        onClick={history.redo}
        disabled={disabled || !history.canRedo}
        aria-label="Повернути скасовану зміну"
        title="Повернути — ⇧⌘Z"
      >
        <Icon name="redo" size={18} />
      </button>
    </div>
  );
}
