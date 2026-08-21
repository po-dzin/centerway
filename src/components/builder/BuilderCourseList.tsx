"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { BuilderFailureNotice, BuilderNotice, BuilderShell } from "./BuilderShell";
import { listCourses, type BuilderCourseSummary, type BuilderFailure } from "./builderClient";
import styles from "./Builder.module.css";

type State =
  | { status: "loading" }
  | { status: "failed"; failure: BuilderFailure; detail?: string }
  | { status: "ready"; courses: BuilderCourseSummary[]; isAdmin: boolean };

export function BuilderCourseList() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    // Guarded, and the await comes first: a synchronous setState inside an
    // effect costs a cascading render for a state the component already starts
    // in. Same shape as the learner surfaces (components/lms/CourseView.tsx).
    let cancelled = false;
    void (async () => {
      const result = await listCourses();
      if (cancelled) return;
      setState(
        result.ok
          ? { status: "ready", courses: result.data.courses, isAdmin: result.data.isAdmin }
          : { status: "failed", failure: result.failure, detail: result.detail }
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <BuilderShell>
        <BuilderNotice title="Завантажуємо курси…" />
      </BuilderShell>
    );
  }

  if (state.status === "failed") {
    return (
      <BuilderShell>
        <BuilderFailureNotice failure={state.failure} detail={state.detail} />
      </BuilderShell>
    );
  }

  return (
    <BuilderShell>
      <div>
        <h1 className={styles.pageTitle}>Курси</h1>
        <p className={styles.pageLead}>
          {state.isAdmin ? "Усі курси платформи." : "Курси, автором яких ви є."}
        </p>
      </div>

      {state.courses.length === 0 ? (
        <BuilderNotice
          title="Тут поки порожньо"
          text="Курс з'являється в білдері після того, як його структуру записано в базу. Новий курс наразі заводить адміністратор."
        />
      ) : (
        <div className={styles.courseGrid}>
          {state.courses.map((course) => (
            <Link key={course.slug} className={styles.courseCard} href={`/build/${course.slug}`}>
              <div className={styles.courseTitleRow}>
                <h2 className={styles.courseTitle}>{course.title}</h2>
                <span className={course.status === "published" ? styles.pillPublished : styles.pill}>
                  {course.status === "published" ? "Опубліковано" : "Чернетка"}
                </span>
              </div>
              <p className={styles.courseMeta}>
                {course.moduleCount} {plural(course.moduleCount, "модуль", "модулі", "модулів")} ·{" "}
                {course.lessonCount} {plural(course.lessonCount, "урок", "уроки", "уроків")}
              </p>
              <p className={styles.courseMeta}>{blockerLine(course.blockerCount)}</p>
            </Link>
          ))}
        </div>
      )}
    </BuilderShell>
  );
}

/* The blocker count is the card's real payload — it answers "what is stopping
   me from publishing this" before the author opens anything. -1 is not a count:
   it means the stored rows do not form a valid course at all, which is a
   different and more urgent problem than a missing paragraph. */
function blockerLine(count: number): string {
  if (count < 0) return "Структура не читається — відкрийте курс, щоб побачити помилку";
  if (count === 0) return "Готовий до публікації";
  return `${count} ${plural(count, "блокер", "блокери", "блокерів")} до публікації`;
}

function plural(count: number, one: string, few: string, many: string): string {
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = count % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
