"use client";

/**
 * The insertion point between two blocks.
 *
 * Split out of BuilderLessonEditor.tsx (1,871 lines, seven components) on 2026-09-10.
 */

import { useRef, useState } from "react";
import { HandGraphic, Icon } from "@/components/Icon";
import type { LessonBlockType } from "@/lms-core";
import { BuilderBlockPicker } from "./BuilderBlockPicker";
import styles from "./Builder.module.css";

/**
 * Adding to the lesson.
 *
 * IT USED TO ASK FIRST. The one control here opened a grid of twelve cards and
 * would not let a word be written until one was chosen — a lesson began with a
 * taxonomy question. An author does not know what kind of thing they are
 * writing before they have written it.
 *
 * So the default is text, immediately, with the caret in it. The SHAPES a
 * paragraph cannot take are one "/" away. And the third door, here, is for
 * TEMPLATES — the blocks that arrive already knowing what job they do. That is
 * a different question, deliberately asked in a different place: choosing
 * «Крок протоколу» is a decision about the lesson's structure, and the grid,
 * with the sentence that says when to reach for each, is the right shape for a
 * decision. It is the wrong shape for "I need a table here".
 */
/**
 * The gap between two blocks.
 *
 * Silent until it is asked for. A ring parked in every gap, with a rule
 * permanently drawn above the first block, made the manuscript read as a form
 * with slots in it — and the chooser it opened used to replace the gap in the
 * flow, so pressing it threw the rest of the lesson down the page. The ring
 * appears on pointing, the rule is drawn with it, and the chooser floats.
 */
export function BlockInsert({
  position,
  drop,
  onActivate,
  onAdd,
}: {
  position: number;
  /** The list has nominated this gap as where the carried block lands. */
  drop?: boolean;
  onActivate: (position: number) => void;
  onAdd: (position: number, type: LessonBlockType) => void;
}) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const ring = useRef<HTMLButtonElement>(null);

  return (
    <div className={styles.blockInsert} data-open={anchor ? "" : undefined} data-drop={drop || undefined} data-gap={position}>
      <button
        ref={ring}
        className={styles.blockInsertAction}
        type="button"
        aria-label="Додати блок"
        title="Додати блок"
        aria-expanded={anchor !== null}
        onClick={() => {
          onActivate(position);
          setAnchor(ring.current?.getBoundingClientRect() ?? null);
        }}
      >
        <Icon name="plus" size={18} />
        <HandGraphic className={styles.blockInsertInkRing} name="ink-ring" size={42} />
      </button>
      {anchor ? (
        <BuilderBlockPicker
          anchor={anchor}
          onPick={(type) => {
            onAdd(position, type);
            setAnchor(null);
          }}
          onClose={() => setAnchor(null)}
        />
      ) : null}
    </div>
  );
}
