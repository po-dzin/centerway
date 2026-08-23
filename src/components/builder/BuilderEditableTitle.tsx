"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/Icon";
import { PLACEHOLDER_MARKER } from "@/lms-core";
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
  const [draft, setDraft] = useState(value);
  const input = useRef<HTMLInputElement>(null);
  const Heading = level;
  const unresolved = value.includes(PLACEHOLDER_MARKER);
  const visibleValue = unresolved ? "" : value;

  useEffect(() => {
    if (editing) {
      input.current?.focus();
      const end = input.current?.value.length ?? 0;
      input.current?.setSelectionRange(end, end);
    }
  }, [editing]);

  const finish = () => {
    onChange(draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={input}
        className={compact ? styles.moduleTitleInput : `${styles.pageTitle} ${styles.titleInput} ${styles.titleEditing}`}
        type="text"
        value={draft}
        placeholder={label.replace(/^Редагувати\s+/i, "")}
        aria-label={label}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={finish}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onChange(before);
            setDraft(before);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <div className={compact ? styles.editableTitleCompact : styles.editableTitle}>
      <Heading className={`${compact ? styles.editableHeadingCompact : styles.pageTitle} ${visibleValue ? "" : styles.editableHeadingEmpty}`}>
        {visibleValue || label.replace(/^Редагувати\s+/i, "")}
      </Heading>
      <button
        className={styles.titleEditAction}
        type="button"
        aria-label={label}
        title={label}
        onClick={() => {
          setBefore(value);
          setDraft(visibleValue);
          setEditing(true);
        }}
      >
        <Icon name="edit" size={16} />
      </button>
    </div>
  );
}
