"use client";

/**
 * An image, put in either way an author actually has one.
 *
 * BOTH, NOT ONE. A link covers the image that is already somewhere — a file
 * shipped in `/public`, something on a CDN, a photo the author already hosts —
 * and copying it into a bucket would make a second original that can go stale.
 * An upload covers the case the builder could not serve at all until now: the
 * author has a file on their machine, and the old field answered that with a
 * text box asking for a path, which is asking a person to be a deployer.
 *
 * ONE VALUE UNDERNEATH. Both write the same `src` string, so nothing downstream
 * — the renderer, the export, the validator — has to know which door it came
 * through. The uploaded one is simply a link that this application made.
 */

import { useRef, useState } from "react";

import { Icon } from "@/components/Icon";

import { uploadMedia } from "./builderClient";
import styles from "./Builder.module.css";

const FAILURES: Record<string, string> = {
  media_missing_file: "Файл не дійшов. Спробуйте ще раз.",
  media_missing_course: "Спершу збережіть курс — зображення кладеться в його теку.",
  media_expected_form_data: "Файл не дійшов. Спробуйте ще раз.",
};

/** The error codes the route returns carry their cause after a colon. */
function explain(detail: string | undefined): string {
  if (!detail) return "Не вдалося завантажити. Спробуйте ще раз.";
  if (detail.startsWith("media_too_large:")) {
    const bytes = Number(detail.split(":")[1]);
    const mb = Number.isFinite(bytes) ? (bytes / (1024 * 1024)).toFixed(1) : "?";
    return `Завеликий файл — ${mb} МБ. Межа 5 МБ.`;
  }
  if (detail.startsWith("media_unsupported_type:")) {
    return "Такий формат не приймається. JPEG, PNG, WebP, GIF або AVIF.";
  }
  return FAILURES[detail] ?? "Не вдалося завантажити. Спробуйте ще раз.";
}

export function BuilderImageField({
  label,
  hint,
  courseSlug,
  src,
  alt,
  onChange,
}: {
  label: string;
  hint?: string;
  /** Which course's folder an uploaded file lands in. */
  courseSlug: string;
  src: string | undefined;
  /** Rendered in the preview so the author sees what a screen reader will say. */
  alt?: string;
  onChange: (src: string | undefined) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const send = async (file: File) => {
    setBusy(true);
    setNote(null);
    const result = await uploadMedia(courseSlug, file);
    setBusy(false);

    if (!result.ok) {
      setNote(explain(result.detail));
      return;
    }
    onChange(result.data.src);
  };

  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>

      {src ? (
        /* eslint-disable-next-line @next/next/no-img-element -- authored content, arbitrary remote hosts */
        <img className={styles.previewImage} src={src} alt={alt ?? ""} />
      ) : null}

      <div className={styles.itemRow}>
        <input
          className={styles.input}
          type="text"
          inputMode="url"
          placeholder="/cw/… або https://…"
          aria-label={`${label} — адреса`}
          value={src ?? ""}
          // Empty is ABSENT, the rule every other field follows.
          onChange={(event) => onChange(event.target.value.trim() === "" ? undefined : event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
        {src ? (
          <button
            className={styles.iconAction}
            type="button"
            title="Прибрати зображення"
            aria-label={`Прибрати ${label.toLowerCase()}`}
            onClick={() => onChange(undefined)}
          >
            <Icon name="close" size={18} />
          </button>
        ) : null}
      </div>

      {/* The picker is a button, not a bare file input: a native file input
          renders as an unstyleable control with its own English label, and this
          one has to sit in a row with a text field without looking like a
          different application. */}
      <div className={styles.addRow}>
        <button
          className={styles.quietAction}
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {busy ? "Завантажуємо…" : "Завантажити файл"}
        </button>
        <span className={styles.fieldHint}>або вставте адресу вище</span>
      </div>

      <input
        ref={input}
        className={styles.visuallyHidden}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared immediately so choosing the SAME file twice still fires a
          // change — the second pick is silently nothing otherwise.
          event.target.value = "";
          if (file) void send(file);
        }}
      />

      {note ? <span className={styles.fieldError}>{note}</span> : null}
      {hint ? <span className={styles.fieldHint}>{hint}</span> : null}
    </div>
  );
}
