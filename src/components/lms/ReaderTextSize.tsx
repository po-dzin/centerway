"use client";

/**
 * The reader's one setting.
 *
 * A protocol course is read from a phone, often lying down, and the size that
 * suits a desk is not the size that suits that. One control, four steps, and
 * the choice is remembered on the device — there is no second knob here and
 * there should not be: line height, measure and rhythm are the design's job,
 * not a menu the reader has to tune.
 *
 * WHY A POPOVER AND NOT A CYCLING BUTTON. A button that steps through sizes
 * hides where you are in the range and makes going back a lap around it. Four
 * targets, each drawn AT the size it sets, answers "what will this do" before
 * it is pressed.
 */

import { useEffect, useRef, useState } from "react";

import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import { READER_SCALE_STEPS } from "./readerSettings";
import styles from "./Lms.module.css";

export function ReaderTextSize({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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

  const current = READER_SCALE_STEPS.find((step) => step.id === value) ?? READER_SCALE_STEPS[1];

  return (
    <div className={styles.sizeControl} ref={rootRef}>
      <button
        className={styles.iconButton}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Розмір тексту: ${current.label.toLowerCase()}`}
      >
        <span aria-hidden="true">Аа</span>
      </button>

      {open ? (
        <div className={styles.sizeMenu} role="menu" aria-label="Розмір тексту">
          {READER_SCALE_STEPS.map((step) => (
            <button
              key={step.id}
              className={step.id === value ? styles.sizeOptionCurrent : styles.sizeOption}
              type="button"
              role="menuitemradio"
              aria-checked={step.id === value}
              /* The shared hover/focus ink rules in globals.css are scoped to
                 `:is(.cw-tab, .cw-nav-link, [data-cw-ink-control])`. Without
                 this attribute the mark below would only ever show its active
                 strength — the row would answer «this is the one» and say
                 nothing at all under the pointer. */
              data-cw-ink-control
              onClick={() => {
                onChange(step.id);
                setOpen(false);
              }}
            >
              <span aria-hidden="true" style={{ fontSize: `${step.scale}rem` }}>
                Аа
              </span>
              {/* The account menu's own gesture, not a copy of it. This used to
                  hand-roll the label/mark pair and reach for its geometry through
                  `composes: menuInkLabel/menuInkMark`, two classes that had not
                  existed since `aac33b76` — so the mark arrived with no position,
                  no height and no colour, and rendered as a bare 36px graphic
                  inside the row instead of a stroke under the word.
                  `InteractionInkLabel` is the only platform entry point for
                  baked ink (AGENTS.md preflight), and `variant="menu"` is the
                  canonical mark for a selected label inside a compound control,
                  which is exactly what a menuitemradio is. */}
              <InteractionInkLabel variant="tab" active={step.id === value}>
                <span className={styles.sizeLabel}>{step.label}</span>
              </InteractionInkLabel>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
