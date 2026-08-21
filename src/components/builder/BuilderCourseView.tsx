"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { BuilderFailureNotice, BuilderNotice, BuilderShell } from "./BuilderShell";
import { loadCourse, saveCourse, type BuilderCourseDto, type BuilderFailure } from "./builderClient";
import { BuilderBlockers } from "./BuilderBlockers";
import styles from "./Builder.module.css";
import { inlineToPlainText } from "@/lms-core";

type State =
  | { status: "loading" }
  | { status: "failed"; failure: BuilderFailure; detail?: string }
  | { status: "ready"; data: BuilderCourseDto };

export function BuilderCourseView({ slug }: { slug: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await loadCourse(slug);
    setState(
      result.ok
        ? { status: "ready", data: result.data }
        : { status: "failed", failure: result.failure, detail: result.detail }
    );
  }, [slug]);

  useEffect(() => {
    // Guarded so switching courses cannot land a stale response, and awaiting
    // before the first setState so the effect does not cascade a render.
    let cancelled = false;
    void (async () => {
      const result = await loadCourse(slug);
      if (cancelled) return;
      setState(
        result.ok
          ? { status: "ready", data: result.data }
          : { status: "failed", failure: result.failure, detail: result.detail }
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  /**
   * Publishing is a status change and nothing else — it does not save edits.
   *
   * The gate lives in `writeCourseStructure`, so a course with blockers is
   * refused by the server rather than by a disabled button here. The button is
   * disabled anyway, because a control that exists only to be rejected is a
   * worse explanation than a sentence saying what is missing.
   */
  async function setStatus(next: "draft" | "published") {
    if (state.status !== "ready" || busy) return;
    setBusy(true);
    setNote(null);

    const result = await saveCourse(slug, { ...state.data.course, status: next });
    setBusy(false);

    if (!result.ok) {
      setNote(result.detail ?? "Не вдалося зберегти. Спробуйте ще раз.");
      return;
    }

    setNote(next === "published" ? "Опубліковано в базі." : "Переведено в чернетку.");
    await load();
  }

  if (state.status === "loading") {
    return (
      <BuilderShell back={{ href: "/build", label: "Курси" }}>
        <BuilderNotice title="Завантажуємо курс…" />
      </BuilderShell>
    );
  }

  if (state.status === "failed") {
    return (
      <BuilderShell back={{ href: "/build", label: "Курси" }}>
        <BuilderFailureNotice failure={state.failure} detail={state.detail} />
      </BuilderShell>
    );
  }

  const { course, readiness } = state.data;
  const published = course.status === "published";

  return (
    <BuilderShell back={{ href: "/build", label: "Курси" }} crumb={course.slug}>
      <div>
        <div className={styles.courseTitleRow}>
          <h1 className={styles.pageTitle}>{course.title}</h1>
          <span className={published ? styles.pillPublished : styles.pill}>
            {published ? "Опубліковано" : "Чернетка"}
          </span>
        </div>
        {course.summary ? <p className={styles.pageLead}>{inlineToPlainText(course.summary)}</p> : null}
      </div>

      <BuilderBlockers blockers={readiness.blockers} />

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Публікація</h2>
        {/* The one thing an author must not misunderstand. Publishing writes
            `published` to the DATABASE; the learner app still reads the course
            files shipped in the last deploy. Saying so here is the whole reason
            it is safe to ship the builder before the source-of-truth switch. */}
        <p className={styles.panelText}>
          Публікація змінює статус курсу в базі. Учні побачать зміни після наступного релізу платформи —
          зараз застосунок читає курси з файлів репозиторію. Щоб перенести правки у файли, виконайте{" "}
          <code>npm run lms:pull -- {course.slug}</code>.
        </p>
        {readiness.ready ? null : (
          <p className={styles.panelText}>
            Опублікувати не вийде, доки лишаються блокери — це та сама перевірка, яку проходить сид.
          </p>
        )}
        <div className={styles.saveBar}>
          <span className={styles.saveState}>{note ?? (published ? "Курс відкритий учням" : "Курс у роботі")}</span>
          {published ? (
            <button className={styles.retreatAction} type="button" onClick={() => setStatus("draft")} disabled={busy}>
              Зняти з публікації
            </button>
          ) : (
            <button
              className={styles.commitAction}
              type="button"
              onClick={() => setStatus("published")}
              disabled={busy || !readiness.ready}
            >
              Опублікувати
            </button>
          )}
        </div>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Структура</h2>
        {course.modules.map((module) => (
          <div key={module.id} className={styles.moduleBlock}>
            <h3 className={styles.moduleTitle}>
              {module.title}
              {module.reference ? " · довідка" : ""}
            </h3>
            {module.lessons.map((lesson) => (
              <Link
                key={lesson.id}
                className={styles.lessonRow}
                href={`/build/${course.slug}/${lesson.slug}`}
              >
                <span className={styles.lessonDay}>
                  {lesson.dayIndex ? `День ${lesson.dayIndex}` : "—"}
                </span>
                <span className={styles.lessonName}>{lesson.title}</span>
                <span className={styles.lessonFlag}>{lesson.blocks.length}</span>
              </Link>
            ))}
          </div>
        ))}
      </section>
    </BuilderShell>
  );
}
