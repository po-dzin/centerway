"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type MouseEventHandler } from "react";

import { HandGraphic, Icon } from "@/components/Icon";
import { PLACEHOLDER_MARKER } from "@/lms-core";
import styles from "./Builder.module.css";

/**
 * A title, in one of two registers.
 *
 * THE REGISTER IS THE POINT, and it took getting wrong twice to see it. In the
 * lesson editor the title IS the document: the words on screen are the words
 * being written, so the title is a field shaped like a heading — no mode, no
 * pencil, press the words and the caret is in them. A control parked beside it
 * would be saying «this text is editable» on the one surface where everything
 * is.
 *
 * On the course screens the same words are a RECORD — a row in a list of
 * modules, a line in a settings sheet. There the reader is scanning rather than
 * writing, and a column of live fields turns a structure into a form: every
 * title looks pressable, none looks final. So a record is a heading with a
 * pencil, and editing is something you ask for.
 *
 * A LINK is always a record. It cannot also be the field, because the link owns
 * the press.
 */
export function BuilderEditableTitle({
  value,
  label,
  level = "h1",
  compact = false,
  register = "document",
  maxLength,
  href,
  onLinkClick,
  onChange,
}: {
  value: string;
  label: string;
  level?: "h1" | "h3" | "h4";
  compact?: boolean;
  /**
   * A ceiling the field simply will not pass.
   *
   * Enforced by the browser rather than by validation on save, because the two
   * teach different things: a field that stops typing says «this is as long as
   * a name gets» while the author is still choosing words, and a message after
   * the fact says «that was wrong» about something they have already finished.
   * Only the course title sets one — see OFFER_TITLE_MAX.
   */
  maxLength?: number;
  /** `document` — the words are the manuscript. `record` — a row being read. */
  register?: "document" | "record";
  href?: string;
  onLinkClick?: MouseEventHandler<HTMLAnchorElement>;
  onChange: (value: string) => void;
}) {
  const field = useRef<HTMLTextAreaElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [before, setBefore] = useState(value);
  const [draft, setDraft] = useState(value);
  const Heading = level;
  const unresolved = value.includes(PLACEHOLDER_MARKER);
  const visibleValue = unresolved ? "" : value;
  const placeholder = label.replace(/^Редагувати\s+/i, "");
  const asRecord = register === "record" || href !== undefined;

  // Grown to its content, in a layout effect so the page is never painted at
  // the wrong height. `scrollHeight` is only honest once the box has been
  // collapsed, which is what the first assignment is for.
  useLayoutEffect(() => {
    const element = field.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [visibleValue, compact, asRecord]);

  useEffect(() => {
    if (!editing) return;
    input.current?.focus();
    const end = input.current?.value.length ?? 0;
    input.current?.setSelectionRange(end, end);
  }, [editing]);

  if (!asRecord) {
    return (
      <textarea
        ref={field}
        className={`${compact ? styles.moduleTitleField : styles.pageTitle} ${styles.titleField}`}
        value={visibleValue}
        rows={1}
        maxLength={maxLength}
        spellCheck
        placeholder={placeholder}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          event.currentTarget.blur();
        }}
      />
    );
  }

  if (editing) {
    return (
      <input
        ref={input}
        className={compact ? styles.moduleTitleInput : `${styles.pageTitle} ${styles.titleInput} ${styles.titleEditing}`}
        type="text"
        value={draft}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={label}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          onChange(draft);
          setEditing(false);
        }}
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

  const open = () => {
    setBefore(value);
    setDraft(visibleValue);
    setEditing(true);
  };

  return (
    <div className={compact ? styles.editableTitleCompact : styles.editableTitle}>
      <Heading
        className={`${compact ? styles.editableHeadingCompact : styles.pageTitle} ${visibleValue ? "" : styles.editableHeadingEmpty} ${href ? "" : styles.headingWritable}`}
        onClick={href ? undefined : open}
      >
        {href ? (
          <Link className={styles.editableTitleLink} href={href} title={visibleValue || undefined} onClick={onLinkClick}>
            {visibleValue || placeholder}
          </Link>
        ) : (
          visibleValue || placeholder
        )}
      </Heading>
      {/* The ring the stylesheet has been styling all along. `.titleEditAction
          :hover .inkRing` existed and matched nothing, because no ring was
          rendered — so the pencil answered the pointer with the sunk plate
          instead, the one highlight the builder is not supposed to draw. */}
      <button className={styles.titleEditAction} type="button" aria-label={label} onClick={open}>
        <Icon name="edit" size={16} />
        <HandGraphic className={styles.inkRing} name="ink-ring" size={42} />
      </button>
    </div>
  );
}
