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

export function OfferCurriculum({
  course,
  landingHref = null,
}: {
  course: Course;
  /**
   * The product's own funnel landing, when it still has one.
   *
   * WHY IT HANGS OFF THE OUTLINE. The outline is the last thing a reader who is
   * still deciding actually reads — it is where «що всередині» runs out and the
   * page has nothing further to say to someone who wants more convincing. The
   * landing is the long version: the argument, the screenshots, the before and
   * after, the formats side by side. Anywhere higher and it would compete with
   * the buy button; anywhere lower and it sits under the checkout, offering an
   * exit to somebody who had already decided to stay.
   *
   * Resolved by the caller (`offerLandingUrl`) rather than here, because which
   * offers have a funnel is a fact about the surface registry and not about a
   * course.
   */
  landingHref?: string | null;
}) {
  const access = useOfferAccess();
  const surfaceHref = useSurfaceHref();

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
            <li key={module.id ?? module.title}>
              {/* NOT AN ACCORDION ANY MORE (2026-09-05). It was a `<details>`
                  per module, and the collapsing was answering a question
                  nobody asks: this outline is three cards and a dozen rows on
                  the longest course in the product, so there was never enough
                  of it to be worth hiding. What the chevrons did instead was
                  put a control on the one block whose whole job is to be read
                  at a glance — and, for an owner, a chance to fold away the
                  lesson they are in the middle of.

                  The whole `openModules` machine went with them: the state,
                  the first-module default, and the effect that had to reopen
                  the current lesson's module because the default had shut it. */}
              <div className={styles.outlineModule}>
                <div className={styles.outlineModuleHead}>
                  <h3 className={styles.outlineModuleTitle}>{module.title}</h3>
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
              </div>
            </li>
          ))}
        </ul>
        {/* FOR AN OWNER TOO, since 2026-09-05. It used to be hidden from them,
            reasoning that somebody who has bought this has no use for the page
            that sells it. That reads the landing as a sales funnel and nothing
            else — it is also the only long-form description this product has of
            what the course actually is: the stages, the formats, the participant
            accounts, the questions. An owner mid-course has more use for that
            than a stranger does, and the note under the button says plainly
            where it goes. */}
        {landingHref ? (
          <div className={styles.outlineMore}>
            {/* A plain anchor, not `Link`: this is a different origin, and the
                router has nothing to prefetch there. */}
            <a className={styles.outlineMoreLink} href={landingHref} rel="noopener">
              Дізнатися більше
            </a>
            <p className={styles.outlineMoreNote}>
              Докладна сторінка програми: історії учасників, формати участі й відповіді на питання.
            </p>
          </div>
        ) : null}
      </article>
    </section>
  );
}

/* The catalogue's inline text is either a string or a run of spans; an offer
   page prints it flat. */
function inlineToText(value: Course["summary"]): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value.map((span) => (typeof span === "string" ? span : span.text)).join("");
}
