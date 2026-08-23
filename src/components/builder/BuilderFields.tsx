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

import { useState, type KeyboardEvent } from "react";

import { inlineToMarkup } from "@/lib/lms/inlineMarkup";
import { PLACEHOLDER_MARKER, youtubeIdFrom, type InlineText } from "@/lms-core";
import { BuilderImageField } from "./BuilderImageField";
import { BuilderInlineEditor } from "./BuilderInlineEditor";
import type { BlockField } from "./blockFields";
import styles from "./Builder.module.css";

function closeOnEnter(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    event.currentTarget.blur();
  }
}

function markerPrompt(value: string): string | undefined {
  const match = /^\[ЗАПОВНИ:\s*(.+)]$/i.exec(value.trim());
  return match?.[1];
}

export function FieldInput({
  field,
  value,
  courseSlug,
  onChange,
}: {
  field: BlockField;
  value: unknown;
  /**
   * Which course an uploaded file belongs to. Only `image` fields need it, and
   * only because an upload has to land in a folder — the rest of the table has
   * no idea what course it is describing, and should not have to.
   */
  courseSlug?: string;
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
          onKeyDown={closeOnEnter}
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
  if (field.kind === "image") {
    return (
      <BuilderImageField
        label={field.label}
        hint={field.hint}
        courseSlug={courseSlug ?? ""}
        src={typeof value === "string" ? value : undefined}
        onChange={(next) => onChange(field.path, next)}
      />
    );
  }

  if (field.kind === "youtube") {
    return (
      <YoutubeField field={field} value={typeof value === "string" ? value : ""} onChange={onChange} />
    );
  }

  const text = typeof value === "string" ? value : "";
  const hasMarker = text.includes(PLACEHOLDER_MARKER);
  const visibleText = hasMarker ? "" : text;
  const placeholder = hasMarker ? markerPrompt(text) : undefined;
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
        <textarea className={className} value={visibleText} placeholder={placeholder} onChange={(event) => handle(event.target.value)} onKeyDown={closeOnEnter} rows={3} />
      ) : (
        <input className={className} type="text" value={visibleText} placeholder={placeholder} onChange={(event) => handle(event.target.value)} onKeyDown={closeOnEnter} />
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
  // Seeded from the stored id and only ever replaced by the author WHILE
  // FOCUSED. Deriving it from `value` on every render would rewrite the
  // address they are in the middle of typing back into a bare id under the
  // caret. But `value` can also change out from under this field with no
  // caret in it at all — undo/redo, a block dropped by drag — and unlike
  // `BuilderInlineEditor`, this is a plain input with no focus/blur hook of
  // its own to re-seed from. `focused` gives it one: the render-phase pattern
  // React's own docs recommend for "adjust state when a prop changes" — not an
  // effect, which would commit one render late and flash the stale value.
  const [draft, setDraft] = useState(value);
  const [seededFrom, setSeededFrom] = useState(value);
  const [focused, setFocused] = useState(false);

  if (value !== seededFrom && !focused) {
    setSeededFrom(value);
    setDraft(value);
  }

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
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          const found = youtubeIdFrom(next);
          // Nothing recognisable means the field is not ready, not that the
          // block should lose the video it already had.
          if (found) onChange(field.path, found);
          else if (next.trim() === "") onChange(field.path, undefined);
        }}
        onKeyDown={closeOnEnter}
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
