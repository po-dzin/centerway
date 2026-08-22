"use client";

/**
 * One field renderer for the whole builder.
 *
 * It used to live inside the lesson editor, which meant the course page had no
 * way to edit anything without growing a second one — and two field renderers
 * are two answers to "what does an emptied optional field mean", which is the
 * question that decides whether a course still validates.
 *
 * The answer, in one place: EMPTY IS ABSENT. The validators accept a missing
 * key where they reject an empty string, so clearing a field deletes it.
 */

import { useState } from "react";

import { inlineToMarkup } from "@/lib/lms/inlineMarkup";
import { PLACEHOLDER_MARKER, youtubeIdFrom, type InlineText } from "@/lms-core";
import { BuilderInlineEditor } from "./BuilderInlineEditor";
import type { BlockField } from "./blockFields";
import styles from "./Builder.module.css";

export function FieldInput({
  field,
  value,
  onChange,
}: {
  field: BlockField;
  value: unknown;
  onChange: (path: (string | number)[], value: unknown) => void;
}) {
  if (field.kind === "boolean") {
    return (
      <label className={styles.field}>
        <span className={styles.fieldLabel}>
          <input
            type="checkbox"
            checked={value === true}
            onChange={(event) => onChange(field.path, event.target.checked || undefined)}
          />{" "}
          {field.label}
        </span>
      </label>
    );
  }

  if (field.kind === "number") {
    return (
      <label className={styles.field}>
        <span className={styles.fieldLabel}>{field.label}</span>
        <input
          className={styles.input}
          type="number"
          inputMode="numeric"
          value={typeof value === "number" ? String(value) : ""}
          // Empty means ABSENT, not zero: an optional number written as 0 is a
          // different claim ("takes no time") from an unset one.
          onChange={(event) =>
            onChange(field.path, event.target.value === "" ? undefined : Number(event.target.value))
          }
        />
      </label>
    );
  }

  // Inline values get the rich surface: three toolbar buttons onto the span
  // model's three features. A `text` field is a path, an id or an href — it has
  // no formatting to offer and a toolbar over it would be three dead buttons.
  if (field.kind === "inline") {
    return (
      <div className={styles.field}>
        <span className={styles.fieldLabel}>{field.label}</span>
        <BuilderInlineEditor
          label={field.label}
          value={(value ?? undefined) as InlineText | undefined}
          multiline={field.multiline}
          onChange={(next) => onChange(field.path, next)}
        />
        {field.hint ? <span className={styles.fieldHint}>{field.hint}</span> : null}
      </div>
    );
  }

  /**
   * A link field whose STORED value is the identifier inside it.
   *
   * The author types a link, because a link is what is in their clipboard; the
   * model keeps the id, because the player builds its own embed URL and has no
   * business parsing YouTube. The draft is local so a half-pasted address does
   * not blank the block on every keystroke — only a recognisable one is written
   * through.
   */
  if (field.kind === "youtube") {
    return (
      <YoutubeField field={field} value={typeof value === "string" ? value : ""} onChange={onChange} />
    );
  }

  const text = typeof value === "string" ? value : "";
  const hasMarker = text.includes(PLACEHOLDER_MARKER);
  const className = `${field.multiline ? styles.textarea : styles.input} ${hasMarker ? styles.inputTodo : ""}`;

  const handle = (next: string) => {
    if (next.trim() === "") {
      onChange(field.path, undefined);
      return;
    }
    onChange(field.path, next);
  };

  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{field.label}</span>
      {field.multiline ? (
        <textarea className={className} value={text} onChange={(event) => handle(event.target.value)} rows={3} />
      ) : (
        <input className={className} type="text" value={text} onChange={(event) => handle(event.target.value)} />
      )}
      {field.hint ? <span className={styles.fieldHint}>{field.hint}</span> : null}
    </label>
  );
}

function YoutubeField({
  field,
  value,
  onChange,
}: {
  field: BlockField;
  value: string;
  onChange: (path: (string | number)[], value: unknown) => void;
}) {
  // Seeded from the stored id and only ever replaced by the author. Deriving it
  // from `value` on every render would rewrite the address they are in the
  // middle of typing back into a bare id under the caret.
  const [draft, setDraft] = useState(value);

  const id = youtubeIdFrom(draft);

  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{field.label}</span>
      <input
        className={styles.input}
        type="text"
        inputMode="url"
        placeholder="https://youtu.be/…"
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          const found = youtubeIdFrom(next);
          // Nothing recognisable means the field is not ready, not that the
          // block should lose the video it already had.
          if (found) onChange(field.path, found);
          else if (next.trim() === "") onChange(field.path, undefined);
        }}
      />
      <span className={styles.fieldHint}>
        {id ? `Відео ${id}` : "Поки не видно ідентифікатора — вставте адресу з YouTube."}
      </span>
      {field.hint ? <span className={styles.fieldHint}>{field.hint}</span> : null}
    </label>
  );
}

/**
 * A closed list of choices, drawn as one row of pressable options.
 *
 * Used everywhere the model already restricts the answer — a palette, a
 * schedule mode, a heading font. A `<select>` would work and would be wrong:
 * these are three-to-seven options the author is choosing BETWEEN, and a
 * dropdown hides every alternative behind a press.
 */
export function ChoiceRow<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  options: Array<{ value: T; label: string; swatch?: string }>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.choiceRow} role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            className={styles.choiceOption}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.swatch ? (
              <span className={styles.choiceSwatch} data-cw-pack={option.swatch} aria-hidden="true" />
            ) : null}
            {option.label}
          </button>
        ))}
      </div>
      {hint ? <span className={styles.fieldHint}>{hint}</span> : null}
    </div>
  );
}

/**
 * An inline value as one line of plain-ish text, for places that show a value
 * without editing it. Uses the markup dialect rather than flattening, so a
 * summary that carries a link still reads as one.
 */
export function inlineOf(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return inlineToMarkup(value);
  if (Array.isArray(value)) return inlineToMarkup(value as never);
  return "";
}
