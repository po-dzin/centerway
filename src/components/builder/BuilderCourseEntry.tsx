"use client";

/**
 * One course on the shelf — as a row or a card — with its controls and the copy its failures print.
 *
 * Split out of BuilderCourseList.tsx (1,115 lines) on 2026-09-11; nothing inside any declaration changed.
 */

import { coverCardStyle } from "@/lib/lms/courseCover";
import { plural } from "@/lib/plural";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { courseThemeAttributes } from "@/lms-core";
import { BuilderMenu } from "./BuilderMenu";
import type { BuilderCourseSummary, BuilderFailure } from "./builderClient";
import { MEDIA_SIZES, mediaSources } from "@/lib/lms/media";
import styles from "./Builder.module.css";
import { ShelfPresentation } from "@/components/platform/cabinet/ShelfPresentation";
import { PENDING_COPY, type PendingAction, type PendingKind } from "./BuilderCourseList";
import type { CourseView } from "./builderShelfView";

export function ViewSwitch({ view, onChange }: { view: CourseView; onChange: (next: CourseView) => void }) {
  return (
    <ShelfPresentation
      label="Вигляд списку"
      value={view}
      onChange={onChange}
      options={[
        { value: "rows", label: "Рядки", icon: "view-rows" },
        { value: "grid", label: "Картки", icon: "view-cards" },
      ]}
    />
  );
}

type EntryProps = {
  course: BuilderCourseSummary;
  /** Position in the WHOLE shelf, not in the filtered view — `onMove` reorders
      the whole shelf, so an index counted within a filter would move a course
      past neighbours the author cannot see. */
  index: number;
  total: number;
  /** False while a query is narrowing the shelf: order belongs to the whole
      list, and it cannot honestly be edited through a keyhole. */
  reorderable: boolean;
  busy: boolean;
  /** Set only when the pending action's slug is this course's. */
  pending: PendingAction | null;
  onMove: (index: number, delta: number) => void;
  onAsk: (slug: string, kind: PendingKind) => void;
  onCancel: () => void;
  onConfirm: () => void;
  /** True while this course is playing its leaving animation. */
  removing?: boolean;
  onExport: (slug: string) => void;
};

/**
 * A course on the shelf: two lines and one control.
 *
 * The row used to put the title, the counts, the status pill and three separate
 * buttons on a single line. At 360px the buttons took 147 of 347 pixels and the
 * title was left with 54 — Ukrainian words are long, so it came out one word
 * per line and the page grew a horizontal scroll. Title first, everything that
 * qualifies it underneath, one menu at the end.
 */
export function CourseRow(props: EntryProps) {
  const { course } = props;
  return (
    <li className={styles.courseRow} data-flip-key={course.slug} data-removing={props.removing || undefined}>
      <Link className={styles.courseRowMain} href={`/build/${course.slug}`}>
        <span className={styles.courseRowTitle}>{course.title}</span>
        {/* One wrapping line, not three stacked ones. Status, size and what is
            stopping a publish all qualify the same title; giving each its own
            row made a five-line card out of a list entry. */}
        <span className={styles.courseRowMeta}>
          <span className={course.status === "published" ? styles.pillPublished : styles.pill}>
            {course.status === "published" ? "Опубліковано" : "Чернетка"}
          </span>
          <span className={styles.courseMeta}>
            {course.moduleCount} {plural(course.moduleCount, "модуль", "модулі", "модулів")} · {course.lessonCount}{" "}
            {plural(course.lessonCount, "урок", "уроки", "уроків")} · {blockerLine(course.blockerCount)}
          </span>
        </span>
      </Link>
      <EntryControls {...props} />
    </li>
  );
}

export function CourseCard(props: EntryProps) {
  const { course } = props;
  return (
    <article
      className={styles.courseCard}
      data-flip-key={course.slug}
      data-removing={props.removing || undefined}
      data-course-status={course.status}
      {...courseThemeAttributes(course.theme ?? undefined)}
    >
      <Link className={styles.courseCardFace} href={`/build/${course.slug}`}>
        {/* THE STATUS BELONGS TO THE OBJECT, so it is worn on the object. Beside
            the title it was a second label competing with the name for the same
            line, and on a wrapped title it fell to a line of its own and read as
            metadata — the one thing it is not. On the cover it is answered
            before the title is even read: what this is, and whether it is out. */}
        <span className={styles.courseCoverFrame}>
          {course.cover ? (
            // Plain <img>: the cover is an author-supplied path that may point
            // anywhere, and next/image would need every one of those hosts
            // configured before it would render at all.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className={styles.courseCover}
              {...mediaSources(course.cover.src)}
              sizes={MEDIA_SIZES.card}
              alt={course.cover.alt}
              loading="lazy"
              decoding="async"
              style={coverCardStyle(course.cover)}
            />
          ) : (
            // Not a grey box: a course with no cover still has a palette, and the
            // initials on it are enough to tell two cards apart at a glance.
            <span className={styles.courseCoverFallback} aria-hidden="true">
              {initialsOf(course.title)}
            </span>
          )}
          <span className={course.status === "published" ? styles.coverPillPublished : styles.coverPill}>
            {course.status === "published" ? "Опубліковано" : "Чернетка"}
          </span>
        </span>
        <span className={styles.courseCardBody}>
          {/* No mark inside the title: the card's own contour carries it — see
              the note beside `.courseCard::after`. An underline measures a
              label; the thing under the pointer here is the whole card. */}
          <span className={styles.courseTitle}>{course.title}</span>
          <span className={styles.courseMeta}>
            {course.moduleCount} {plural(course.moduleCount, "модуль", "модулі", "модулів")} · {course.lessonCount}{" "}
            {plural(course.lessonCount, "урок", "уроки", "уроків")}
          </span>
          <span className={styles.courseMeta}>{blockerLine(course.blockerCount)}</span>
        </span>
      </Link>
      <EntryControls {...props} />
    </article>
  );
}

export function EntryControls({
  course,
  index,
  total,
  reorderable,
  busy,
  pending,
  onMove,
  onAsk,
  onCancel,
  onConfirm,
  onExport,
}: EntryProps) {
  const focusRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (pending) focusRef.current?.focus();
  }, [pending]);

  if (pending?.phase === "confirm") {
    const copy = PENDING_COPY[pending.kind];
    return (
      <div
        className={styles.confirmRow}
        role="group"
        aria-label={`Підтвердження дії з курсом «${course.title}»`}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
      >
        <span className={styles.confirmText} title={course.title}>
          {copy.question}
        </span>
        <button ref={focusRef} className={styles.quietAction} type="button" onClick={onCancel} disabled={busy}>
          Ні
        </button>
        <button
          className={copy.commitDanger ? styles.dangerAction : styles.retreatAction}
          type="button"
          onClick={onConfirm}
          disabled={busy}
        >
          {copy.commitLabel}
        </button>
      </div>
    );
  }

  /* THE SERVER'S ANSWER, IN THE QUESTION'S OWN SEAT (2026-08-28).
     A refusal used to surface as a line at the top of the shelf — the one
     sentence explaining "учні вже проходять цей курс" sat above a grid the
     reader had scrolled three screens past. It now reopens in the exact
     footprint the confirmation used, on the course it is about, with one way
     out rather than two: there is nothing left to choose between. */
  if (pending?.phase === "error") {
    return (
      <div className={styles.confirmRow} role="alert" aria-label={`Курс «${course.title}»`}>
        <span className={styles.confirmText}>{pending.message}</span>
        <button ref={focusRef} className={styles.quietAction} type="button" onClick={onCancel}>
          Зрозуміло
        </button>
      </div>
    );
  }

  return (
    <BuilderMenu
      label={`Дії з курсом «${course.title}»`}
      items={[
        {
          label: "Підняти вище",
          icon: "arrow-up",
          hint: reorderable
            ? "Курс піде вище в списку — порядок пише sort_order"
            : "Порядок міняється на повному списку — зніміть пошук або фільтр",
          onSelect: () => onMove(index, -1),
          disabled: busy || !reorderable || index === 0,
        },
        {
          label: "Опустити нижче",
          icon: "arrow-down",
          hint: reorderable
            ? "Курс піде нижче в списку — порядок пише sort_order"
            : "Порядок міняється на повному списку — зніміть пошук або фільтр",
          onSelect: () => onMove(index, 1),
          disabled: busy || !reorderable || index === total - 1,
        },
        {
          label: "Експортувати JSON",
          icon: "export",
          hint: "Завантажити переносимий знімок поточної версії курсу",
          onSelect: () => onExport(course.slug),
          disabled: busy,
        },
        ...(course.status === "published"
          ? [
              {
                label: "Зняти з публікації",
                icon: "unpublish" as const,
                hint: "Курс перестане приймати нових учнів; ті, хто вже проходить його, збережуть доступ",
                onSelect: () => onAsk(course.slug, "unpublish"),
                disabled: busy,
                startsGroup: true,
              },
            ]
          : []),
        {
          label: "Видалити",
          icon: "trash",
          /* The hint names the rule that will actually apply to THIS course.
             A published one has a first step before deleting is even a
             question; a draft's only remaining gate is whether anyone is
             enrolled, which the shelf cannot see from here. */
          hint:
            course.status === "published"
              ? "Спершу зніміть курс з публікації — опублікований курс не видаляється"
              : "Курс із учнями не видаляється: їхню історію не можна стерти",
          onSelect: () => onAsk(course.slug, "delete"),
          disabled: busy,
          danger: true,
          startsGroup: course.status !== "published",
        },
      ]}
    />
  );
}

/* The server's refusals, in the author's words. Each one names what to do
   instead, because "не вдалося видалити" on its own turns a rule into a bug
   report. */

export function deleteFailureCopy(status: BuilderCourseSummary["status"], detail?: string): string {
  if (!detail) return "Не вдалося видалити курс.";
  if (detail.startsWith("lms_builder_delete_published")) {
    return "Опублікований курс не видаляється. Спершу зніміть його з публікації.";
  }
  /* THE ADVICE HAS TO BE FOLLOWABLE (2026-08-29), and this one was not.
     The sentence ended «Зніміть його з публікації» for every course — including
     a DRAFT, which is already unpublished. An author deleting an empty test
     course was told to undo a state it was not in, so the refusal read as the
     builder malfunctioning rather than as a rule.

     Publication is not what this gate is about. Access is: someone holds an
     enrolment — bought, or granted by hand in the admin panel — and deleting
     the course would cascade their history away. So the sentence names the
     access, and the only place it can be withdrawn. */
  if (detail.startsWith("lms_builder_delete_has_learners")) {
    return status === "published"
      ? "Курс мають учні — видалення стерло б їхню історію. Зніміть його з публікації; щоб видалити назовсім, спершу заберіть доступи в адмінці."
      : "Курс уже мають учні — видалення стерло б їхню історію. Доступи (зокрема видані вручну) знімаються в адмінці, у розділі доступів.";
  }
  if (detail.startsWith("lms_builder_unknown_course")) {
    return "Курсу вже немає в базі. Оновіть сторінку.";
  }
  if (detail.startsWith("lms_builder_delete_check_failed")) {
    return "Не вдалося перевірити, чи можна видалити курс. Спробуйте ще раз.";
  }
  /* Anything else with an `lms_` prefix is an internal code, not a sentence.
     Returning `detail` unchanged is how a raw
     "lms_builder_delete_failed:violates foreign key constraint" would land on
     screen as the whole explanation. */
  if (detail.startsWith("lms_")) return "Не вдалося видалити курс.";
  return detail;
}

/** Same shape as `deleteFailureCopy`: the server's refusal, in the author's words. */
export function unpublishFailureCopy(result: { failure: BuilderFailure; detail?: string }): string {
  if (result.failure === "conflict") {
    return "Цей курс уже змінили в іншій вкладці. Відкрийте його, щоб побачити актуальну версію.";
  }
  if (result.failure === "not_found") {
    return "Курсу вже немає в базі. Оновіть список.";
  }
  if (result.detail && !result.detail.startsWith("lms_")) return result.detail;
  return "Не вдалося зняти курс з публікації.";
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

function initialsOf(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}
