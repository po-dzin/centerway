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

/**
 * The star beside a label of a field the publish gate actually holds.
 *
 * `aria-hidden` on the glyph and a real word for a screen reader: a person
 * listening to the form hears «обов'язково», not "asterisk". The input itself
 * carries `aria-required`, which is what assistive tech acts on; this is the
 * visible half of the same statement.
 */
export function RequiredMark() {
  return (
    <>
      <span className={styles.fieldRequired} aria-hidden="true">*</span>
      <span className={styles.visuallyHidden}> — обов&apos;язково</span>
    </>
  );
}

/**
 * The counter under a bounded field.
 *
 * Silent until it is worth saying something. A counter that is always on turns
 * every field into a test the author is failing by not having finished typing;
 * it appears at three quarters of the ceiling, which is where the number stops
 * being trivia and starts being a warning.
 *
 * The two limits read differently on purpose — the hard one says what will not
 * be accepted, the soft one says what will be cut on a card — because the
 * author's choice is different in each case.
 */
function FieldCount({ value, max, soft }: { value: string; max?: number; soft?: number }) {
  const length = [...value].length;
  if (max !== undefined && length >= Math.floor(max * 0.75)) {
    return (
      <span className={length >= max ? styles.fieldError : styles.fieldHint} aria-live="polite">
        {length} / {max}
        {length >= max ? " — довше не приймається" : ""}
      </span>
    );
  }
  if (soft !== undefined && length > soft) {
    return (
      <span className={styles.fieldWarning} aria-live="polite">
        {length} символів — на картці вміщається {soft}, решту буде обрізано
      </span>
    );
  }
  return null;
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
    const number = typeof value === "number" ? value : undefined;
    // The bounds are the validator's, handed in as `min`/`max` on the field
    // descriptor. Out of range is SHOWN rather than swallowed: a number field
    // that silently ignores 400 looks broken, and one that silently keeps it
    // fails at save time on a screen the author has already left.
    const out =
      number !== undefined &&
      ((field.min !== undefined && number < field.min) || (field.max !== undefined && number > field.max));

    return (
      <label className={styles.field}>
        <span className={styles.fieldLabel}>
          {field.label}
          {field.required ? <RequiredMark /> : null}
        </span>
        <input
          className={out ? `${styles.input} ${styles.inputInvalid}` : styles.input}
          type="number"
          inputMode="numeric"
          min={field.min}
          max={field.max}
          aria-required={field.required ? true : undefined}
          aria-invalid={out || undefined}
          value={number === undefined ? "" : String(number)}
          // Empty means ABSENT, not zero: an optional number written as 0 is a
          // different claim ("takes no time") from an unset one.
          onChange={(event) =>
            onChange(field.path, event.target.value === "" ? undefined : Number(event.target.value))
          }
          onKeyDown={closeOnEnter}
        />
        {out ? (
          <span className={styles.fieldError}>
            Має бути від {field.min ?? 1} до {field.max}. Поки так — курс не збережеться.
          </span>
        ) : null}
        {field.hint ? <span className={styles.fieldHint}>{field.hint}</span> : null}
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
    // Clipped rather than refused. A paste one character over the ceiling would
    // otherwise be silently dropped in full, and the author sees an input that
    // did nothing when they pressed ⌘V. `maxLength` on the element does the
    // same for typing; this covers the paths it does not (paste, drop, IME).
    onChange(field.path, field.maxLength ? [...next].slice(0, field.maxLength).join("") : next);
  };

  const shared = {
    className,
    value: visibleText,
    placeholder,
    "aria-required": field.required ? (true as const) : undefined,
    maxLength: field.maxLength,
    onChange: (event: { target: { value: string } }) => handle(event.target.value),
    onKeyDown: closeOnEnter,
  };

  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>
        {field.label}
        {field.required ? <RequiredMark /> : null}
      </span>
      {field.multiline ? <textarea {...shared} rows={3} /> : <input {...shared} type="text" />}
      <FieldCount value={visibleText} max={field.maxLength} soft={field.softLength} />
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
  required,
  clearable,
  onChange,
}: {
  label: string;
  hint?: string;
  options: Array<{ value: T; label: string; swatch?: string }>;
  value: T | undefined;
  required?: true;
  /**
   * Whether pressing the chosen option again unsets the field.
   *
   * Off by default, because most closed lists in this builder answer a question
   * that always has an answer — a course HAS a palette, a schedule HAS a mode,
   * and there is no such thing as unsetting them. A field that is genuinely
   * optional is the other case, and it needs a way back to "not said" that is
   * not "pick something wrong".
   */
  clearable?: true;
  onChange: (next: T | undefined) => void;
}) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>
        {label}
        {required ? <RequiredMark /> : null}
      </span>
      <div className={styles.choiceRow} role="group" aria-label={label}>
        {options.map((option) => {
          const on = option.value === value;
          return (
            <button
              key={option.value}
              className={styles.choiceOption}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on && clearable ? undefined : option.value)}
            >
              {option.swatch ? (
                <span className={styles.choiceSwatch} data-cw-pack={option.swatch} aria-hidden="true" />
              ) : null}
              {option.label}
            </button>
          );
        })}
      </div>
      {hint ? <span className={styles.fieldHint}>{hint}</span> : null}
    </div>
  );
}

/**
 * The same closed list, when more than one answer is true at once.
 *
 * Sections are like that — a course can be about цleansing and харчування
 * together — and forcing one would make the author pick the least wrong of two
 * true answers. Drawn identically to `ChoiceRow` on purpose: the difference
 * between "pick one" and "pick any" is carried by `role="group"` +
 * `aria-pressed` on checkboxes rather than by a different-looking control,
 * because two shapes of chip row would be two things to learn.
 */
export function ChoiceSet<T extends string>({
  label,
  hint,
  options,
  values,
  required,
  onChange,
}: {
  label: string;
  hint?: string;
  options: Array<{ value: T; label: string }>;
  values: T[];
  required?: true;
  onChange: (next: T[] | undefined) => void;
}) {
  // EMPTY IS ABSENT, the rule the whole builder follows: the validator rejects
  // a stored `[]`, so unchecking the last one deletes the field.
  const write = (next: T[]) => onChange(next.length > 0 ? next : undefined);

  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>
        {label}
        {required ? <RequiredMark /> : null}
      </span>
      <div className={styles.choiceRow} role="group" aria-label={label}>
        {options.map((option) => {
          const on = values.includes(option.value);
          return (
            <button
              key={option.value}
              className={styles.choiceOption}
              type="button"
              aria-pressed={on}
              onClick={() =>
                write(on ? values.filter((one) => one !== option.value) : [...values, option.value])
              }
            >
              {option.label}
            </button>
          );
        })}
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
