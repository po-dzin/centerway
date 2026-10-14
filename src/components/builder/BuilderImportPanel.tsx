"use client";

/**
 * The import panel: a course from a file.
 *
 * Split out of BuilderCourseList.tsx (1,115 lines) on 2026-09-11; nothing inside any declaration changed.
 */

import { useRef, useState } from "react";
import {
  commitCourseImport,
  previewCourseImport,
  type BuilderCourseSummary,
  type CourseImportPreview,
} from "./builderClient";
import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import styles from "./Builder.module.css";

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

type ImportState =
  | { status: "empty" }
  | { status: "checking"; filename: string }
  | { status: "failed"; message: string }
  | { status: "ready"; filename: string; course: unknown; preview: CourseImportPreview }
  | { status: "committing"; filename: string; course: unknown; preview: CourseImportPreview };

/** A two-step boundary: inspect first, write only after explicit confirmation. */
export function ImportPanel({
  onCancel,
  onImported,
  courses,
}: {
  onCancel: () => void;
  onImported: (slug: string) => void;
  courses: BuilderCourseSummary[];
}) {
  const [targetSlug, setTargetSlug] = useState("");
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
    const result = await previewCourseImport(course, targetSlug || undefined);
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
    const result = await commitCourseImport(
      current.course,
      targetSlug || undefined,
      current.preview.expectedGeneration,
    );
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
        Виберіть JSON з Builder або напишіть курс за зразком. ID та інші технічні поля заповнимо автоматично. Спершу ми
        покажемо перевірку; запис відбудеться лише після підтвердження.
      </p>

      <a className={styles.importSampleLink} href="/examples/course-import.json" download data-cw-ink-control>
        <InteractionInkLabel variant="link">Завантажити зразок JSON</InteractionInkLabel>
      </a>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Куди імпортувати</span>
        <select
          className={`${styles.input} ${styles.select}`}
          value={targetSlug}
          disabled={waiting}
          onChange={(event) => {
            setTargetSlug(event.target.value);
            setState({ status: "empty" });
          }}
        >
          <option value="">Створити новий курс</option>
          {courses.map((course) => (
            <option key={course.slug} value={course.slug}>
              Оновити: {course.title}
            </option>
          ))}
        </select>
        {targetSlug ? (
          <span className={styles.fieldHint}>
            JSON замінить вміст чернетки вибраного курсу. Адреса й доступи збережуться; опублікована версія залишиться
            доступною учням до окремої публікації.
          </span>
        ) : null}
      </label>

      {/* The file is a field like the target above it: a label, the control,
          then what the control says back — the file's name, or why it did not
          land, in the boundary tone and in place rather than on a plate. */}
      <div className={styles.field}>
        <span className={styles.fieldLabel}>Файл курсу</span>
        <div className={styles.addRow}>
          <button
            className={styles.quietAction}
            type="button"
            disabled={waiting}
            onClick={() => picker.current?.click()}
          >
            {state.status === "checking" ? "Перевіряємо…" : "Вибрати JSON"}
          </button>
          <span className={styles.fieldHint}>
            {"filename" in state ? state.filename : "До 5 МБ; медіа залишаються посиланнями"}
          </span>
        </div>
        {state.status === "failed" ? (
          <p className={styles.fieldError} role="alert">
            {state.message}
          </p>
        ) : null}
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

      {ready ? (
        <div className={styles.importPreview} aria-live="polite">
          <strong>{ready.preview.title}</strong>
          <span>
            Адреса: <code>{ready.preview.slug}</code> · {ready.preview.moduleCount} мод. · {ready.preview.lessonCount}{" "}
            ур. · {ready.preview.blockCount} блоків
          </span>
          <span>
            {targetSlug
              ? "Оновиться чернетка вибраного курсу; адреса та доступи збережуться."
              : "Імпорт створить приховану чернетку з новими ID без прив’язки до оплат."}
          </span>
          <span>
            {ready.preview.blockerCount === 0
              ? "Структура готова до подальшого редагування."
              : `${ready.preview.blockerCount} блокерів публікації залишаться видимими в Builder.`}
          </span>
          {ready.preview.blockers.length ? (
            <ul className={styles.blockerList}>
              {ready.preview.blockers.map((blocker, index) => (
                <li key={index} className={styles.blockerItem}>
                  <span className={styles.blockerDetail}>
                    {blocker.message ?? blocker.detail ?? "Доповніть матеріал перед публікацією"}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className={styles.panelActions}>
        <span className={styles.panelStatus}>
          {ready ? "Перевірку пройдено; запис тільки як чернетка" : "Файл ще не записано"}
        </span>
        <div className={styles.panelChoice}>
          <button className={styles.retreatAction} type="button" onClick={onCancel} disabled={waiting}>
            Скасувати
          </button>
          <button
            className={styles.commitAction}
            type="button"
            onClick={() => void commit()}
            disabled={!ready || waiting}
          >
            {state.status === "committing" ? "Імпортуємо…" : targetSlug ? "Оновити чернетку" : "Імпортувати чернетку"}
          </button>
        </div>
      </div>
    </div>
  );
}
