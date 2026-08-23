"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./Builder.module.css";

/** A heading first, a field only while the author explicitly edits it. */
export function BuilderEditableTitle({
  value,
  label,
  level = "h1",
  compact = false,
  onChange,
}: {
  value: string;
  label: string;
  level?: "h1" | "h3";
  compact?: boolean;
  onChange: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [before, setBefore] = useState(value);
  const input = useRef<HTMLInputElement>(null);
  const Heading = level;

  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={input}
        className={compact ? styles.moduleTitleInput : `${styles.pageTitle} ${styles.titleInput} ${styles.titleEditing}`}
        type="text"
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            setEditing(false);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onChange(before);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <div className={compact ? styles.editableTitleCompact : styles.editableTitle}>
      <Heading className={compact ? styles.editableHeadingCompact : styles.pageTitle}>{value || label}</Heading>
      <button
        className={styles.titleEditAction}
        type="button"
        aria-label={label}
        title={label}
        onClick={() => {
          setBefore(value);
          setEditing(true);
        }}
      >
        Змінити
      </button>
    </div>
  );
}
