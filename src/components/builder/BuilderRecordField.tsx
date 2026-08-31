"use client";

import { useRef, useState } from "react";

import { Icon } from "@/components/Icon";
import { inlineToPlainText, type InlineText } from "@/lms-core";
import { BuilderInlineEditor } from "./BuilderInlineEditor";
import styles from "./Builder.module.css";

/**
 * A line of prose ABOUT something, rather than the something itself.
 *
 * The course's summary sits above a sheet of settings rows — each of them a
 * label, a value and a pencil — and read as the odd one out when it was a live
 * field: the only line on the page with a caret in it, in a column of things
 * you look at. Same register as its neighbours now, and the same pencil.
 *
 * Editing hands over to the ordinary inline editor, so the markup dialect,
 * the formatting bar and the placeholder are the ones the rest of the builder
 * uses. It closes when focus genuinely leaves — `relatedTarget` inside the box
 * is the formatting bar being pressed, not the author walking away.
 */
export function BuilderRecordField({
  value,
  label,
  placeholder,
  multiline,
  onChange,
}: {
  value: InlineText | undefined;
  label: string;
  placeholder: string;
  multiline?: boolean;
  onChange: (next: InlineText | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  if (editing) {
    return (
      <div
        ref={box}
        onBlur={(event) => {
          if (box.current?.contains(event.relatedTarget as Node | null)) return;
          if ((event.relatedTarget as Element | null)?.closest?.("[data-builder-format-toolbar]")) return;
          setEditing(false);
        }}
      >
        <BuilderInlineEditor
          bare
          autoFocus
          multiline={multiline}
          value={value}
          label={label}
          placeholder={placeholder}
          onChange={onChange}
        />
      </div>
    );
  }

  const text = inlineToPlainText(value ?? "").trim();
  return (
    <div className={styles.recordField}>
      <p className={text ? undefined : styles.editableHeadingEmpty} onClick={() => setEditing(true)}>
        {text || placeholder}
      </p>
      <button className={styles.titleEditAction} type="button" aria-label={label} title={label} onClick={() => setEditing(true)}>
        <Icon name="edit" size={16} />
      </button>
    </div>
  );
}
