"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { programs } from "@/lib/platform/content";
import { COURSE_PALETTES, COURSE_TEMPLATES, courseThemeAttributes, moveItem, type CoursePalette } from "@/lms-core";
import { BuilderFailureNotice, BuilderNotice, BuilderShell } from "./BuilderShell";
import { ChoiceRow } from "./BuilderFields";
import { BuilderMenu } from "./BuilderMenu";
import { PALETTE_LABELS } from "./coursePalettes";
import {
  createCourse,
  deleteCourse,
  listCourses,
  reorderCourses,
  type BuilderCourseSummary,
  type BuilderFailure,
} from "./builderClient";
import styles from "./Builder.module.css";

type State =
  | { status: "loading" }
  | { status: "failed"; failure: BuilderFailure; detail?: string }
  | { status: "ready"; courses: BuilderCourseSummary[]; isAdmin: boolean; canCreate: boolean };

type CourseView = "rows" | "grid";

const VIEW_KEY = "cw.builder.courseView";
/* `storage` only reaches OTHER tabs, so the writing tab announces itself. */
const VIEW_EVENT = "cw:builder-view";

function subscribeToView(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(VIEW_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(VIEW_EVENT, onChange);
  };
}

/**
 * The chosen view, read from storage rather than mirrored into state.
 *
 * Not `useState` + an effect: localStorage does not exist on the server, so the
 * value cannot be the initial state, and copying it in after mount is a second
 * render of a tree that was already correct — the pattern React now flags. This
 * reads the store directly and renders "rows" on the server, which is what the
 * author sees for the one frame before hydration either way.
 */
function readView(): CourseView {
  const stored = window.localStorage.getItem(VIEW_KEY);
  return stored === "grid" ? "grid" : "rows";
}

/**
 * Whether there is room for the card grid at all.
 *
 * Below 561px there is not, and the switch does not appear. A grid of cards on
 * a 360px screen is one card per row — the same list, three times taller, with
 * a cover pushing the title and the blocker count off the first screen. The
 * grid is a desk affordance; offering it on a phone is offering a worse list.
 */
const WIDE = "(min-width: 561px)";

function subscribeToWidth(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * The builder's front door.
 *
 * TWO VIEWS OF ONE SHELF, and they answer different questions. Rows are for
 * WORK: one line per course, the blocker count and the status where the eye
 * already is, and the reorder controls in reach — an author with eleven courses
 * scans a list, not a wall of pictures. The grid is for RECOGNITION: covers,
 * titles, the course as an object. Which one is right depends on the day, so
 * the choice is the author's and it is remembered.
 *
 * The preference lives in `localStorage` rather than in the database. It is a
 * property of this screen on this device — the same author on a phone wants
 * rows and on a desktop wants the grid — and a column would have made it one
 * global opinion that follows them onto the wrong device.
 */
export function BuilderCourseList() {
  const [state, setState] = useState<State>({ status: "loading" });
  const stored = useSyncExternalStore(subscribeToView, readView, () => "rows" as CourseView);
  // Server-side and on a phone: rows. The card grid is only ever a choice where
  // there is width for it.
  const wide = useSyncExternalStore(subscribeToWidth, () => window.matchMedia(WIDE).matches, () => false);
  const view: CourseView = wide ? stored : "rows";
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await listCourses();
    setState(
      result.ok
        ? {
            status: "ready",
            courses: result.data.courses,
            isAdmin: result.data.isAdmin,
            canCreate: result.data.canCreate,
          }
        : { status: "failed", failure: result.failure, detail: result.detail }
    );
  }, []);

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
          ? {
              status: "ready",
              courses: result.data.courses,
              isAdmin: result.data.isAdmin,
              canCreate: result.data.canCreate,
            }
          : { status: "failed", failure: result.failure, detail: result.detail }
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const chooseView = (next: CourseView) => {
    window.localStorage.setItem(VIEW_KEY, next);
    // Tell this tab: `storage` fires in the OTHER tabs, never in the one that
    // wrote. Without it the switch would set a value nothing re-reads.
    window.dispatchEvent(new Event(VIEW_EVENT));
  };

  /**
   * Moves a card and writes the whole new order.
   *
   * Optimistic on purpose: the list re-renders before the request lands, so a
   * press moves the thing under the author's finger instead of after a round
   * trip. A failed write says so and reloads — the shelf then shows what the
   * server actually holds, which is the honest thing to do with an order that
   * did not save.
   */
  async function move(index: number, delta: number) {
    if (state.status !== "ready" || busy) return;
    const next = moveItem(state.courses, index, index + delta);
    if (next === state.courses) return;

    setState({ ...state, courses: next });
    setBusy(true);
    setNote(null);
    const result = await reorderCourses(next.map((course) => course.slug));
    setBusy(false);
    if (!result.ok) {
      setNote(result.detail ?? "Не вдалося зберегти порядок.");
      await load();
    }
  }

  async function create(input: { title: string; programSlug: string; template: string; palette: string }) {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const result = await createCourse(input);
    setBusy(false);
    if (!result.ok) {
      setNote(result.detail ?? "Не вдалося створити курс.");
      return;
    }
    setCreating(false);
    await load();
  }

  async function remove(slug: string) {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const result = await deleteCourse(slug);
    setBusy(false);
    setConfirmingDelete(null);
    if (!result.ok) {
      setNote(deleteFailureCopy(result.detail));
      return;
    }
    await load();
  }

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
        <BuilderFailureNotice failure={state.failure} detail={state.detail} scope="shelf" />
      </BuilderShell>
    );
  }

  return (
    <BuilderShell trail={[{ label: "Курси" }]}>
      {/* Title and the one primary action share a row. Stacked in a column the
          button read as a step in the page rather than as the thing you do to
          it, and cost a full band of vertical space above the shelf. */}
      <div>
        {/* The action sits beside the TITLE, not beside the title-and-lead: the
            lead is a full sentence and pushed the button onto its own row at
            360px, which is the column the request was to get out of. */}
        <div className={styles.pageHead}>
          <h1 className={styles.pageTitle}>Курси</h1>
          {state.canCreate && !creating ? (
            <button className={styles.commitAction} type="button" onClick={() => setCreating(true)}>
              Новий курс
            </button>
          ) : null}
        </div>
        <p className={styles.pageLead}>
          {state.isAdmin ? "Усі курси платформи." : "Курси, автором яких ви є."}
        </p>
      </div>

      {state.canCreate && creating ? (
        <CreatePanel busy={busy} onCancel={() => setCreating(false)} onCreate={create} />
      ) : null}

      {note ? <p className={styles.noticeLine}>{note}</p> : null}

      {state.courses.length === 0 ? (
        <BuilderNotice
          title="Тут поки порожньо"
          text={
            state.canCreate
              ? "Створіть перший курс — він з'явиться чернеткою з одним модулем і одним уроком."
              : "Курс з'являється тут, коли його передають вам як автору. Напишіть адміністратору."
          }
        />
      ) : (
        <>
          {wide ? (
            <div className={styles.listBar}>
              <span className={styles.listCount}>
                {state.courses.length} {plural(state.courses.length, "курс", "курси", "курсів")}
              </span>
              <ViewSwitch view={stored} onChange={chooseView} />
            </div>
          ) : null}
          {view === "grid" ? (
        <div className={styles.courseGrid}>
          {state.courses.map((course, index) => (
            <CourseCard
              key={course.slug}
              course={course}
              index={index}
              total={state.courses.length}
              busy={busy}
              confirming={confirmingDelete === course.slug}
              onMove={move}
              onAskDelete={setConfirmingDelete}
              onDelete={remove}
            />
          ))}
        </div>
      ) : (
        <ul className={styles.courseRows}>
          {state.courses.map((course, index) => (
            <CourseRow
              key={course.slug}
              course={course}
              index={index}
              total={state.courses.length}
              busy={busy}
              confirming={confirmingDelete === course.slug}
              onMove={move}
              onAskDelete={setConfirmingDelete}
              onDelete={remove}
            />
          ))}
        </ul>
          )}
        </>
      )}
    </BuilderShell>
  );
}

function ViewSwitch({ view, onChange }: { view: CourseView; onChange: (next: CourseView) => void }) {
  return (
    <div className={styles.viewSwitch} role="group" aria-label="Вигляд списку">
      {/* Words, not glyphs. There is no icon in the baked sprite that means
          "a grid of cards", and the dot/orbit layer is navigation BETWEEN
          blocks — Icon.tsx says in as many words never to put it in a text row.
          Used that way it came out as a vertical ellipsis and a ring of dots
          where the switch should be, naming neither view. Two short words are
          unambiguous and cost the bar about the same room. */}
      <button
        className={styles.viewOption}
        type="button"
        aria-pressed={view === "rows"}
        onClick={() => onChange("rows")}
      >
        Рядки
      </button>
      <button
        className={styles.viewOption}
        type="button"
        aria-pressed={view === "grid"}
        onClick={() => onChange("grid")}
      >
        Картки
      </button>
    </div>
  );
}

/**
 * Creating a course asks four things, and two of them are choices from a list.
 *
 * The TITLE, because the slug is derived from it. The PROGRAM, because that is
 * the catalogue entry whose buyers this course serves — a course attached to
 * nothing is a course nobody can ever be enrolled into.
 *
 * Then the TEMPLATE and the GAMMA, and both are here rather than on the course
 * page for the same reason: they are cheap to pick now and expensive to change
 * later. A template writes the whole skeleton — twenty-one days of it, in one
 * case — and applying one to a course that already has lessons is a merge
 * nobody asked for. A gamma is one field either way, but an author picking the
 * look while they are naming the thing is picking it once instead of
 * discovering the setting three screens later.
 *
 * Everything else — schedule details, entitlement codes, the cover — has a sane
 * default and is edited on the course's own page, where there is room to say
 * what each one does. The template sets the schedule; the author can move it.
 */
function CreatePanel({
  busy,
  onCancel,
  onCreate,
}: {
  busy: boolean;
  onCancel: () => void;
  onCreate: (input: { title: string; programSlug: string; template: string; palette: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [programSlug, setProgramSlug] = useState(programs[0]?.slug ?? "");
  const [template, setTemplate] = useState(COURSE_TEMPLATES[0].id as string);
  const [palette, setPalette] = useState<CoursePalette>("default");

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>Новий курс</h2>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Назва</span>
        <input
          className={styles.input}
          type="text"
          value={title}
          autoFocus
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Програма в каталозі</span>
        <select
          className={styles.input}
          value={programSlug}
          onChange={(event) => setProgramSlug(event.target.value)}
        >
          {programs.map((program) => (
            <option key={program.slug} value={program.slug}>
              {program.title}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Структура</span>
        <div className={styles.typeGrid}>
          {COURSE_TEMPLATES.map((option) => (
            <button
              key={option.id}
              className={styles.typeOption}
              type="button"
              aria-pressed={option.id === template}
              onClick={() => setTemplate(option.id)}
            >
              <span className={styles.typeName}>{option.title}</span>
              <span className={styles.typeHint}>{option.summary}</span>
            </button>
          ))}
        </div>
      </div>

      <ChoiceRow
        label="Гама"
        hint="Можна змінити будь-коли на сторінці курсу."
        options={COURSE_PALETTES.map((option) => ({
          value: option,
          label: PALETTE_LABELS[option],
          swatch: option === "default" ? undefined : option,
        }))}
        value={palette}
        onChange={setPalette}
      />

      <p className={styles.readOnlyNote}>
        Адреса курсу утвориться з назви й далі не змінюється. Шаблон створює скелет із позначеними
        дірками — опублікувати його не вийде, доки їх не заповнено.
      </p>
      <div className={styles.panelActions}>
        <span className={styles.panelStatus}>{title.trim() === "" ? "Потрібна назва" : "Готово"}</span>
        <button className={styles.retreatAction} type="button" onClick={onCancel} disabled={busy}>
          Скасувати
        </button>
        <button
          className={styles.commitAction}
          type="button"
          onClick={() => onCreate({ title: title.trim(), programSlug, template, palette })}
          disabled={busy || title.trim() === "" || programSlug === ""}
        >
          {busy ? "Створюємо…" : "Створити"}
        </button>
      </div>
    </section>
  );
}

type EntryProps = {
  course: BuilderCourseSummary;
  index: number;
  total: number;
  busy: boolean;
  confirming: boolean;
  onMove: (index: number, delta: number) => void;
  onAskDelete: (slug: string | null) => void;
  onDelete: (slug: string) => void;
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
function CourseRow(props: EntryProps) {
  const { course } = props;
  return (
    <li className={styles.courseRow}>
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
            {course.moduleCount} {plural(course.moduleCount, "модуль", "модулі", "модулів")} ·{" "}
            {course.lessonCount} {plural(course.lessonCount, "урок", "уроки", "уроків")} ·{" "}
            {blockerLine(course.blockerCount)}
          </span>
        </span>
      </Link>
      <EntryControls {...props} />
    </li>
  );
}

function CourseCard(props: EntryProps) {
  const { course } = props;
  return (
    <article className={styles.courseCard} {...courseThemeAttributes(course.theme ?? undefined)}>
      <Link className={styles.courseCardFace} href={`/build/${course.slug}`}>
        {course.cover ? (
          // Plain <img>: the cover is an author-supplied path that may point
          // anywhere, and next/image would need every one of those hosts
          // configured before it would render at all.
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.courseCover} src={course.cover.src} alt={course.cover.alt} />
        ) : (
          // Not a grey box: a course with no cover still has a palette, and the
          // initials on it are enough to tell two cards apart at a glance.
          <span className={styles.courseCoverFallback} aria-hidden="true">
            {initialsOf(course.title)}
          </span>
        )}
        <span className={styles.courseCardBody}>
          <span className={styles.courseTitleRow}>
            <span className={styles.courseTitle}>{course.title}</span>
            <span className={course.status === "published" ? styles.pillPublished : styles.pill}>
              {course.status === "published" ? "Опубліковано" : "Чернетка"}
            </span>
          </span>
          <span className={styles.courseMeta}>
            {course.moduleCount} {plural(course.moduleCount, "модуль", "модулі", "модулів")} ·{" "}
            {course.lessonCount} {plural(course.lessonCount, "урок", "уроки", "уроків")}
          </span>
          <span className={styles.courseMeta}>{blockerLine(course.blockerCount)}</span>
        </span>
      </Link>
      <EntryControls {...props} />
    </article>
  );
}

/**
 * Reorder and delete, behind one control in both views.
 *
 * Arrows rather than drag-and-drop, and the reason is the phone: a drag needs a
 * long-press, a scroll lock and an autoscroll edge to be usable on touch at
 * all, and it is unreachable from a keyboard without building a second control
 * beside it. The menu items ARE that second control, so they are the only one.
 *
 * Delete asks in place. A `window.confirm` is the wrong shape here — it is the
 * one dialog the design system cannot style, and its wording cannot say WHICH
 * course is about to go.
 */
function EntryControls({ course, index, total, busy, confirming, onMove, onAskDelete, onDelete }: EntryProps) {
  if (confirming) {
    return (
      <div className={styles.confirmRow}>
        <span className={styles.confirmText}>Видалити «{course.title}»?</span>
        <button className={styles.quietAction} type="button" onClick={() => onAskDelete(null)} disabled={busy}>
          Ні
        </button>
        <button className={styles.dangerAction} type="button" onClick={() => onDelete(course.slug)} disabled={busy}>
          Видалити
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
          hint: "Курс піде вище в списку — порядок пише sort_order",
          onSelect: () => onMove(index, -1),
          disabled: busy || index === 0,
        },
        {
          label: "Опустити нижче",
          icon: "arrow-down",
          hint: "Курс піде нижче в списку — порядок пише sort_order",
          onSelect: () => onMove(index, 1),
          disabled: busy || index === total - 1,
        },
        {
          label: "Видалити",
          icon: "trash",
          hint: "Опублікований курс і курс з учнями видалити не можна",
          onSelect: () => onAskDelete(course.slug),
          disabled: busy,
          danger: true,
        },
      ]}
    />
  );
}

/* The server's refusals, in the author's words. Each one names what to do
   instead, because "не вдалося видалити" on its own turns a rule into a bug
   report. */
function deleteFailureCopy(detail?: string): string {
  if (!detail) return "Не вдалося видалити курс.";
  if (detail.startsWith("lms_builder_delete_published")) {
    return "Опублікований курс не видаляється. Спершу зніміть його з публікації.";
  }
  if (detail.startsWith("lms_builder_delete_has_learners")) {
    return "Курс уже проходили учні — видалення стерло б їхню історію. Зніміть його з публікації.";
  }
  return detail;
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

function plural(count: number, one: string, few: string, many: string): string {
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = count % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
