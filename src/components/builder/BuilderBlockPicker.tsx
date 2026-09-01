"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Icon } from "@/components/Icon";
import type { LessonBlockType } from "@/lms-core";
import { BLOCK_STRUCTURE_ORDER, BLOCK_TEMPLATE_ORDER, BLOCK_TYPE_HINTS, BLOCK_TYPE_LABELS } from "./blockFields";
import { InkLabel } from "./BuilderInkLabel";
import styles from "./Builder.module.css";

/**
 * The list of block types, over the document rather than inside it.
 *
 * IT USED TO BE A SECTION IN THE MANUSCRIPT. Pressing the ring in a gap
 * replaced that gap with a panel two hundred pixels tall, so everything below
 * the author's place in the lesson jumped down the page, and closing it jumped
 * it back. A chooser is a momentary thing; it has no business moving the text
 * it is about to be inserted into.
 *
 * Placement is measured against the ring and clamped inside the viewport, the
 * same contract the row menu keeps — fixed positioning against a rect, because
 * CSS anchor positioning is not yet safe in every browser an author might open
 * this in.
 */

const GROUPS: Array<{ title: string; types: LessonBlockType[] }> = [
  { title: "Текст і медіа", types: ["rich_text", ...BLOCK_STRUCTURE_ORDER] as LessonBlockType[] },
  { title: "Практика і навчання", types: [...BLOCK_TEMPLATE_ORDER] as LessonBlockType[] },
];

/**
 * Under the ring, clamped inside the viewport, flipped above only when there is
 * genuinely more room there — a chooser that flips on a few pixels of
 * difference reads as a glitch.
 */
function placeAgainst(anchor: DOMRect) {
  if (typeof window === "undefined") return null;
  const width = Math.min(WIDTH, window.innerWidth - EDGE * 2);
  const left = Math.min(
    Math.max(EDGE, anchor.left + anchor.width / 2 - width / 2),
    window.innerWidth - width - EDGE
  );
  const below = window.innerHeight - anchor.bottom - GAP - EDGE;
  const above = anchor.top - GAP - EDGE;
  const flip = below < 220 && above > below;
  return {
    top: flip ? Math.max(EDGE, anchor.top - GAP - Math.min(above, 420)) : anchor.bottom + GAP,
    left,
    maxHeight: Math.max(180, Math.min(420, flip ? above : below)),
  };
}

const EDGE = 8;
const GAP = 8;
/** Matches `.pickerPanel { width }`; the clamp needs a number before layout. */
const WIDTH = 460;

export function BuilderBlockPicker({
  anchor,
  onPick,
  onClose,
  excludedTypes = [],
}: {
  /** The ring that opened it, in viewport coordinates. */
  anchor: DOMRect;
  onPick: (type: LessonBlockType) => void;
  onClose: () => void;
  excludedTypes?: LessonBlockType[];
}) {
  const [query, setQuery] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  // Derived, not stored: the anchor is a rect the caller measured at the moment
  // of the press, so placement is a function of it and needs no render to
  // settle into. Holding it in state would mean one frame in the wrong place.
  const place = placeAgainst(anchor);

  useEffect(() => {
    field.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    const onDown = (event: MouseEvent) => {
      if (event.target instanceof Node && panel.current?.contains(event.target)) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  if (typeof document === "undefined" || !place) return null;


  const needle = query.trim().toLocaleLowerCase("uk");
  const groups = GROUPS.map((group) => ({
    ...group,
    types: group.types.filter((type) => !excludedTypes.includes(type)).filter((type) =>
      `${BLOCK_TYPE_LABELS[type]} ${BLOCK_TYPE_HINTS[type]}`.toLocaleLowerCase("uk").includes(needle)
    ),
  })).filter((group) => group.types.length > 0);

  return createPortal(
    <div
      ref={panel}
      className={styles.pickerPanel}
      role="dialog"
      aria-label="Додати блок"
      style={{ top: place.top, left: place.left, maxHeight: place.maxHeight }}
    >
      <label className={styles.pickerSearch}>
        <Icon name="view-rows" size={18} />
        <input
          ref={field}
          value={query}
          placeholder="Пошук блоків…"
          aria-label="Пошук блоків"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            const first = groups[0]?.types[0];
            if (!first) return;
            event.preventDefault();
            onPick(first);
          }}
        />
      </label>
      <div className={styles.pickerBody}>
        {groups.map((group) => (
          <section className={styles.pickerGroup} key={group.title}>
            <h3>{group.title}</h3>
            {group.types.map((type) => (
              <button
                key={type}
                className={styles.pickerOption}
                type="button"
                title={BLOCK_TYPE_HINTS[type]}
                onClick={() => onPick(type)}
              >
                <InkLabel>{BLOCK_TYPE_LABELS[type]}</InkLabel>
              </button>
            ))}
          </section>
        ))}
        {groups.length === 0 ? <p className={styles.toolEmpty}>Нічого не знайдено.</p> : null}
      </div>
    </div>,
    document.body
  );
}
