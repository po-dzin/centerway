"use client";

/**
 * The import panel: a course from a file.
 *
 * Split out of BuilderCourseList.tsx (1,115 lines) on 2026-09-11; nothing inside any declaration changed.
 */

import { useRef, useState } from "react";
import { commitCourseImport, previewCourseImport, type CourseImportPreview } from "./builderClient";
import styles from "./Builder.module.css";

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

type ImportState =
  | { status: "empty" }
  | { status: "checking"; filename: string }
  | { status: "failed"; message: string }
  | { status: "ready"; filename: string; course: unknown; preview: CourseImportPreview }
  | { status: "committing"; filename: string; course: unknown; preview: CourseImportPreview };

/** A two-step boundary: inspect first, write only after explicit confirmation. */
export function ImportPanel({ onCancel, onImported }: { onCancel: () => void; onImported: (slug: string) => void }) {
  const picker = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportState>({ status: "empty" });

  async function inspect(file: File) {
    if (file.size > MAX_IMPORT_BYTES) {
      setState({ status: "failed", message: "Файл завеликий. JSON курсу має бути не більше 5 МБ." });
      return;
    }

    let course: unknown;
    try {
      course = JSON.parse(await file.text()) as unknown;
    } catch {
      setState({ status: "failed", message: "Файл не є коректним JSON." });
      return;
    }

    setState({ status: "checking", filename: file.name });
    const result = await previewCourseImport(course);
    if (!result.ok) {
      setState({ status: "failed", message: result.detail ?? "Структура курсу не пройшла перевірку." });
      return;
    }
    setState({ status: "ready", filename: file.name, course, preview: result.data.preview });
  }

  async function commit() {
    if (state.status !== "ready") return;
    const current = state;
    setState({ ...current, status: "committing" });
    const result = await commitCourseImport(current.course);
    if (!result.ok) {
      setState({ status: "failed", message: result.detail ?? "Не вдалося імпортувати курс." });
      return;
    }
    onImported(result.data.slug);
  }

  const waiting = state.status === "checking" || state.status === "committing";
  const ready = state.status === "ready" || state.status === "committing" ? state : null;

  return (
    /* No `.panel` and no heading of its own: the sheet is already a surface with
       a titled head, and a card inside it would be a second plate at a second
       radius holding one form. */
    <div className={styles.importForm}>
      <p className={styles.panelText}>
        Виберіть JSON, експортований з Builder або сумісний з <code>lms:import</code>. Спершу ми покажемо
        перевірку; запис відбудеться лише після підтвердження.
      </p>

      <div className={styles.addRow}>
        <button className={styles.quietAction} type="button" disabled={waiting} onClick={() => picker.current?.click()}>
          {state.status === "checking" ? "Перевіряємо…" : "Вибрати JSON"}
        </button>
        <span className={styles.fieldHint}>
          {"filename" in state ? state.filename : "До 5 МБ; медіа залишаються посиланнями"}
        </span>
      </div>
      <input
        ref={picker}
        className={styles.visuallyHidden}
        type="file"
        accept="application/json,.json"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void inspect(file);
        }}
      />

      {state.status === "failed" ? (
        <p className={styles.noticeLine} role="alert">
          {state.message}
        </p>
      ) : null}

      {ready ? (
        <div className={styles.importPreview} aria-live="polite">
          <strong>{ready.preview.title}</strong>
          <span>
            Адреса: <code>{ready.preview.slug}</code> · {ready.preview.moduleCount} мод. · {ready.preview.lessonCount} ур. ·{" "}
            {ready.preview.blockCount} блоків
          </span>
          <span>
            Імпорт створить приховану чернетку, нові ID і не перенесе прив’язки до оплат.
          </span>
          <span>
            {ready.preview.blockerCount === 0
              ? "Структура готова до подальшого редагування."
              : `${ready.preview.blockerCount} блокерів публікації залишаться видимими в Builder.`}
          </span>
        </div>
      ) : null}

      <div className={styles.panelActions}>
        <span className={styles.panelStatus}>
          {ready ? "Перевірку пройдено; запис тільки як чернетка" : "Файл ще не записано"}
        </span>
        <button className={styles.retreatAction} type="button" onClick={onCancel} disabled={waiting}>
          Скасувати
        </button>
        <button className={styles.commitAction} type="button" onClick={() => void commit()} disabled={!ready || waiting}>
          {state.status === "committing" ? "Імпортуємо…" : "Імпортувати чернетку"}
        </button>
      </div>
    </div>
  );
}
