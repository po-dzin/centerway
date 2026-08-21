"use client";

import { useCallback, useEffect, useState } from "react";

import { BuilderFailureNotice, BuilderNotice, BuilderShell } from "./BuilderShell";
import { loadCourse, saveCourse, type BuilderFailure } from "./builderClient";
import { BLOCK_TYPE_LABELS, describeBlock, readPath, writePath, type BlockField } from "./blockFields";
import { inlineToMarkup, markupToInline } from "@/lib/lms/inlineMarkup";
import { PLACEHOLDER_MARKER, type Course, type Lesson, type LessonBlock } from "@/lms-core";
import styles from "./Builder.module.css";

type State =
  | { status: "loading" }
  | { status: "failed"; failure: BuilderFailure; detail?: string }
  | { status: "ready"; course: Course };

/**
 * The editor — the part of the builder an author actually spends time in.
 *
 * WHOLE-COURSE STATE, ONE LESSON ON SCREEN. The save contract is a complete
 * course (see the API route), so the editor holds the whole thing and edits one
 * lesson inside it. That is not a compromise: it is what makes "save" a single
 * atomic write that either validates as a course or does not happen — no state
 * where a lesson saved and the course it belongs to did not.
 *
 * TEXT IS MARKUP, NOT PLAIN. Inline values round-trip through the dialect in
 * lib/lms/inlineMarkup.ts, which is covered by a test over every inline value in
 * both shipped courses. Flattening to plain text would have deleted emphasis
 * and links from two thirds of the real content on first save.
 */
export function BuilderLessonEditor({ slug, lessonSlug }: { slug: string; lessonSlug: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    // Guarded, and awaiting before the first setState: a synchronous setState in
    // an effect cascades a render for a state the component already starts in.
    let cancelled = false;
    void (async () => {
      const result = await loadCourse(slug);
      if (cancelled) return;
      setState(
        result.ok
          ? { status: "ready", course: result.data.course }
          : { status: "failed", failure: result.failure, detail: result.detail }
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Plain derivation, not memoized: it is two array scans over a handful of
  // modules, and the shape the compiler could not memoize anyway.
  const located = state.status === "ready" ? locateLesson(state.course, lessonSlug) : null;

  /** Applies a change to one path inside the current lesson. */
  const editLesson = useCallback(
    (path: (string | number)[], value: unknown) => {
      setState((current) => {
        if (current.status !== "ready" || !located) return current;
        const full = ["modules", located.moduleIndex, "lessons", located.lessonIndex, ...path];
        return { status: "ready", course: writePath(current.course, full, value) };
      });
      setDirty(true);
      setNote(null);
    },
    [located]
  );

  // The browser's own guard. An author who edits a lesson on a phone and
  // switches apps should not lose the paragraph they just wrote to a reload.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  async function save() {
    if (state.status !== "ready" || busy) return;
    setBusy(true);
    setNote(null);

    const result = await saveCourse(slug, state.course);
    setBusy(false);

    if (!result.ok) {
      // Kept verbatim: a validation code names the exact block that is wrong.
      setNote(result.detail ?? "Не вдалося зберегти. Спробуйте ще раз.");
      return;
    }

    setDirty(false);
    setNote(
      result.data.blockers.length === 0
        ? "Збережено. Блокерів немає."
        : `Збережено. Лишилось блокерів: ${result.data.blockers.length}.`
    );
  }

  if (state.status === "loading") {
    return (
      <BuilderShell back={{ href: `/build/${slug}`, label: "Курс" }}>
        <BuilderNotice title="Завантажуємо урок…" />
      </BuilderShell>
    );
  }

  if (state.status === "failed") {
    return (
      <BuilderShell back={{ href: `/build/${slug}`, label: "Курс" }}>
        <BuilderFailureNotice failure={state.failure} detail={state.detail} />
      </BuilderShell>
    );
  }

  if (!located) {
    return (
      <BuilderShell back={{ href: `/build/${slug}`, label: "Курс" }}>
        <BuilderNotice title="Урок не знайдено" text={`У курсі немає уроку «${lessonSlug}».`} />
      </BuilderShell>
    );
  }

  const lesson = state.course.modules[located.moduleIndex].lessons[located.lessonIndex] as Lesson;

  return (
    <BuilderShell back={{ href: `/build/${slug}`, label: "Курс" }} crumb={lesson.slug}>
      <div>
        <h1 className={styles.pageTitle}>{lesson.title}</h1>
        <p className={styles.pageLead}>
          {state.course.modules[located.moduleIndex].title}
          {lesson.dayIndex ? ` · день ${lesson.dayIndex}` : ""}
        </p>
      </div>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Урок</h2>
        <FieldInput
          field={{ path: ["title"], label: "Назва", kind: "text" }}
          value={lesson.title}
          onChange={editLesson}
        />
        <FieldInput
          field={{ path: ["dayIndex"], label: "День курсу", kind: "number" }}
          value={lesson.dayIndex}
          onChange={editLesson}
        />
        <FieldInput
          field={{ path: ["summary"], label: "Короткий опис", kind: "inline", multiline: true }}
          value={lesson.summary}
          onChange={editLesson}
        />
        {/* Slug is shown and not editable. It is in every reminder already sent,
            every Telegram link and every bookmark, and renaming it here would
            break them all with no warning — a rename is a migration, not a
            text field. */}
        <p className={styles.readOnlyNote}>
          Адреса уроку: <code>/learn/{state.course.slug}/{lesson.slug}</code> — не змінюється, бо вона вже є в
          надісланих нагадуваннях і збережених посиланнях.
        </p>
      </section>

      <div className={styles.blockList}>
        {lesson.blocks.map((block, index) => (
          <BlockEditor key={block.id} block={block} index={index} onChange={editLesson} />
        ))}
      </div>

      <div className={styles.saveBar}>
        <span className={styles.saveState}>
          {note ?? (dirty ? "Є незбережені зміни" : "Змін немає")}
        </span>
        <button className={styles.barAction} type="button" onClick={save} disabled={busy || !dirty}>
          {busy ? "Зберігаємо…" : "Зберегти"}
        </button>
      </div>
    </BuilderShell>
  );
}

function locateLesson(course: Course, lessonSlug: string): { moduleIndex: number; lessonIndex: number } | null {
  for (let moduleIndex = 0; moduleIndex < course.modules.length; moduleIndex += 1) {
    const lessonIndex = course.modules[moduleIndex].lessons.findIndex((lesson) => lesson.slug === lessonSlug);
    if (lessonIndex >= 0) return { moduleIndex, lessonIndex };
  }
  return null;
}

function BlockEditor({
  block,
  index,
  onChange,
}: {
  block: LessonBlock;
  index: number;
  onChange: (path: (string | number)[], value: unknown) => void;
}) {
  const fields = describeBlock(block);

  return (
    <section className={styles.blockCard}>
      <div className={styles.blockHead}>
        <span className={styles.blockType}>{BLOCK_TYPE_LABELS[block.type]}</span>
      </div>
      {fields.map((field) => (
        <FieldInput
          key={field.path.join(".")}
          field={field}
          value={readPath(block, field.path)}
          onChange={(path, value) => onChange(["blocks", index, ...path], value)}
        />
      ))}
    </section>
  );
}

function FieldInput({
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

  const text = field.kind === "inline" ? inlineOf(value) : typeof value === "string" ? value : "";
  const hasMarker = text.includes(PLACEHOLDER_MARKER);
  const className = `${field.multiline ? styles.textarea : styles.input} ${hasMarker ? styles.inputTodo : ""}`;

  const handle = (next: string) => {
    if (next.trim() === "") {
      // Empty is absent. The validators reject empty strings where they accept
      // a missing key, so clearing a field has to delete it — otherwise the
      // course stops validating the moment someone empties an optional line.
      onChange(field.path, undefined);
      return;
    }
    onChange(field.path, field.kind === "inline" ? markupToInline(next) : next);
  };

  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{field.label}</span>
      {field.multiline ? (
        <textarea className={className} value={text} onChange={(event) => handle(event.target.value)} rows={3} />
      ) : (
        <input className={className} type="text" value={text} onChange={(event) => handle(event.target.value)} />
      )}
    </label>
  );
}

function inlineOf(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return inlineToMarkup(value);
  if (Array.isArray(value)) return inlineToMarkup(value as never);
  return "";
}
