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
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/Icon";
import type { CwIconName } from "@/components/iconNames";
import { useOfferAccess } from "@/components/platform/OfferAccess";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import type { Course, CourseModule, LessonAvailability } from "@/lms-core";
import styles from "./PlatformOfferCommerce.module.css";
import offerStyles from "./PlatformOfferStyles";

type LessonState = {
  kind: "locked" | "open" | "done" | "current";
  glyph: CwIconName | null;
  /** Why this row is shut, when the reason is the schedule rather than the purchase. */
  note: string | null;
};

/* Identity for the open/closed set. Falls back to the index because `id` and
   `slug` are both optional on a module coming out of the snapshot, and two
   modules may legitimately share a title. */
function moduleKey(module: CourseModule, index: number): string {
  return module.id ?? module.slug ?? `${index}`;
}

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

  /* WHICH MODULES START OPEN. The first one, always — an accordion where
     everything is shut is a list of headings, and a reader deciding whether to
     buy has to click before the page tells them anything.

     For an owner, also the module they are actually in. Landing on this page
     with your current lesson folded away is the page forgetting where you were.

     Held in state rather than computed inline because a person's own clicks
     have to survive a re-render: `access` changes twice on this page (ownership,
     then the outline), and a derived `open` would slam every module back to its
     default underneath the reader's hand. */
  const [openModules, setOpenModules] = useState<Set<string>>(
    () => new Set(course.modules.length > 0 ? [moduleKey(course.modules[0], 0)] : [])
  );

  function toggleModule(key: string, open: boolean) {
    setOpenModules((current) => {
      if (current.has(key) === open) return current;
      const next = new Set(current);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  /* Opened ONCE, when the shelf first says where the learner stopped. Not on
     every render: after this fires, the module is in `openModules` like any
     other, so closing it stays closed. */
  const revealedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!currentSlug || revealedFor.current === currentSlug) return;
    const index = course.modules.findIndex((module) =>
      module.lessons.some((lesson) => lesson.slug === currentSlug)
    );
    if (index < 0) return;
    revealedFor.current = currentSlug;
    toggleModule(moduleKey(course.modules[index], index), true);
    // `course.modules` is the authored structure and does not change between
    // renders of one page; the lesson slug is what this reacts to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSlug]);

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
          {course.modules.map((module, index) => (
            <li key={module.id ?? module.title}>
              {/* NATIVE `<details>`, not a div with a click handler. It is
                  keyboard-operable, exposed to assistive tech, findable by the
                  browser's own in-page search, and it opens with JavaScript
                  off — four things a hand-rolled accordion has to reimplement
                  and usually gets wrong. */}
              <details
                className={styles.outlineModule}
                open={openModules.has(moduleKey(module, index))}
                onToggle={(event) => toggleModule(moduleKey(module, index), event.currentTarget.open)}
              >
                <summary className={styles.outlineModuleHead}>
                  <h3 className={styles.outlineModuleTitle}>{module.title}</h3>
                  <Icon className={styles.outlineChevron} name="chevron-down" size={20} />
                </summary>
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
              </details>
            </li>
          ))}
        </ul>
        {/* NOT FOR AN OWNER. Somebody who has bought this has no use for the
            page that sells it, and offering them a sales funnel where the next
            lesson should be is the platform forgetting who it is talking to. */}
        {landingHref && !owned ? (
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
