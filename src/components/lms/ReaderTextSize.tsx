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

import { HandGraphic } from "@/components/Icon";
import { READER_SCALE_STEPS } from "./readerSettings";
import styles from "./Lms.module.css";

export function ReaderTextSize({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
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
              onClick={() => {
                onChange(step.id);
                setOpen(false);
              }}
            >
              <span aria-hidden="true" style={{ fontSize: `${step.scale}rem` }}>
                Аа
              </span>
              {/* The row's own ink, the same mark the account menu uses: faint
                  under the pointer, full on the size in force. */}
              <span className={styles.sizeInkLabel}>
                <span className={styles.sizeLabel}>{step.label}</span>
                <HandGraphic className={styles.sizeInkMark} name="ink-stroke" size={36} />
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
