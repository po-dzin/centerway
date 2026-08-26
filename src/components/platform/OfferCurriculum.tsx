"use client";

/**
 * What is actually inside the course — and, once it is yours, where you are in
 * it.
 *
 * ONE BLOCK, NOT TWO. The obvious build is a marketing outline for strangers
 * and a course map for owners. That is two components saying the same thing,
 * drifting apart the first time a module is renamed, and it makes buying feel
 * like arriving somewhere else. So this is one list in four states, and the
 * transition a buyer sees is padlocks lifting off rows they were already
 * reading.
 *
 * WHAT A LOCKED ROW SHOWS AND WHAT IT WITHHOLDS. Titles, always — they are the
 * promise, and a buyer deciding is entitled to the whole shape of the thing.
 * Summaries and blocks, never: those are the goods. This is why the block reads
 * the authored `Course` and not the learner API — the outline is public
 * information, and gating it behind a request would make the page's own table of
 * contents depend on being signed in.
 *
 * Client, because the state depends on the reader (see `OfferAccess.tsx`). The
 * course itself is passed in from the server component that already loaded it —
 * no second read.
 */

import Link from "next/link";

import { Icon } from "@/components/Icon";
import type { CwIconName } from "@/components/iconNames";
import { useOfferAccess } from "@/components/platform/OfferAccess";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import type { Course, LessonAvailability } from "@/lms-core";
import styles from "./PlatformOfferCommerce.module.css";
import offerStyles from "./PlatformOfferStyles";

type LessonState = {
  kind: "locked" | "open" | "done" | "current";
  glyph: CwIconName | null;
  /** Why this row is shut, when the reason is the schedule rather than the purchase. */
  note: string | null;
};

/** Only reachable on a hard-gated course, where the schedule really does shut the door. */
function scheduleNote(availability: LessonAvailability): string {
  if (availability.available) return "";
  if (availability.reason === "locked_by_day") {
    return availability.daysRemaining === 1
      ? "відкриється завтра"
      : `відкриється через ${availability.daysRemaining} дн.`;
  }
  return "спершу заверши попередній урок";
}

export function OfferCurriculum({ course }: { course: Course }) {
  const access = useOfferAccess();
  const surfaceHref = useSurfaceHref();

  const lessonCount = course.modules.reduce((total, module) => total + module.lessons.length, 0);
  const owned = access.state === "owned";
  const outline = owned ? access.outline : null;
  const currentSlug = owned ? access.shelf.currentLessonSlug : null;

  /* The map is keyed by slug because that is the only identifier the authored
     course and the learner API are guaranteed to agree on — ids are stable in
     the database, and the snapshot fallback is a different row set. */
  const bySlug = new Map((outline ?? []).map((entry) => [entry.slug, entry]));

  function stateFor(lessonSlug: string): LessonState {
    // Not owned, or the answer has not arrived yet. `unknown` renders as locked
    // deliberately: it is what an anonymous reader sees, and briefly showing a
    // buyer a padlock is recoverable in a way that briefly showing a stranger an
    // open course is not.
    if (!owned) return { kind: "locked", glyph: "lock", note: null };

    const entry = bySlug.get(lessonSlug);
    // Owned, but the second read has not landed. Open, with no decoration —
    // ownership is what removes the padlock; the ticks only decorate.
    if (!entry) {
      return { kind: "open", glyph: null, note: null };
    }
    if (!entry.availability.available) {
      return { kind: "locked", glyph: "lock", note: scheduleNote(entry.availability) };
    }
    if (entry.completed) return { kind: "done", glyph: "check", note: null };
    if (entry.slug === currentSlug) return { kind: "current", glyph: "play", note: null };
    return { kind: "open", glyph: null, note: null };
  }

  return (
    <section
      className={`${offerStyles.container} ${offerStyles.section}`}
      data-cw-semantic-role="offer-detail"
      data-cw-semantic-family="method-progress"
      data-cw-token-source="global-app-ds"
      id="program-plan"
    >
      <article className={offerStyles.panel}>
        <p className={offerStyles.label}>Що всередині</p>
        <h2 className={offerStyles.title}>Програма курсу</h2>
        <p className={offerStyles.lead}>{course.summary ? inlineToText(course.summary) : null}</p>
        <ul className={styles.outline}>
          {course.modules.map((module) => (
            <li className={styles.outlineModule} key={module.id ?? module.title}>
              <div className={styles.outlineModuleHead}>
                <h3 className={styles.outlineModuleTitle}>{module.title}</h3>
                <span className={styles.outlineCount}>{module.lessons.length}</span>
              </div>
              <ul className={styles.outlineLessons}>
                {module.lessons.map((lesson) => {
                  const state = stateFor(lesson.slug);
                  return (
                    <li className={styles.outlineLesson} data-state={state.kind} key={lesson.slug}>
                      <span className={styles.outlineLessonGlyph}>
                        {state.glyph ? <Icon name={state.glyph} size={20} /> : null}
                      </span>
                      <span>
                        {state.kind === "locked" ? (
                          lesson.title
                        ) : (
                          <Link
                            className={styles.outlineLessonLink}
                            href={surfaceHref(`/learn/${course.slug}/${lesson.slug}`)}
                          >
                            {lesson.title}
                          </Link>
                        )}
                        {state.note ? <span className={styles.outlineLessonNote}>{state.note}</span> : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
        <p className={styles.priceNote}>
          {course.modules.length} {plural(course.modules.length, "модуль", "модулі", "модулів")} ·{" "}
          {lessonCount} {plural(lessonCount, "урок", "уроки", "уроків")}
        </p>
      </article>
    </section>
  );
}

/* Ukrainian counts take three forms, and "3 уроки / 5 уроків" is the kind of
   thing a reader notices immediately when it is wrong. */
function plural(count: number, one: string, few: string, many: string): string {
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = count % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/* The catalogue's inline text is either a string or a run of spans; an offer
   page prints it flat. */
function inlineToText(value: Course["summary"]): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value.map((span) => (typeof span === "string" ? span : span.text)).join("");
}
