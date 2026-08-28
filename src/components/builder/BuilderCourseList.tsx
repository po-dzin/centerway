"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

import { courseThemeAttributes, moveItem } from "@/lms-core";
import { BuilderFailureNotice, BuilderNotice, BuilderShell } from "./BuilderShell";
import { BuilderMenu } from "./BuilderMenu";
import { BuilderSheet } from "./BuilderSheet";
import { HandGraphic, Icon } from "@/components/Icon";
import {
  commitCourseImport,
  createCourse,
  deleteCourse,
  exportCourseFile,
  listCourses,
  previewCourseImport,
  reorderCourses,
  type CourseImportPreview,
  type BuilderCourseSummary,
  type BuilderFailure,
} from "./builderClient";
import { MEDIA_SIZES, mediaSources } from "@/lib/lms/media";
import styles from "./Builder.module.css";
import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";
import { PlatformPageHead } from "@/components/platform/PlatformPageHead";

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
/**
 * How long a course takes to leave, and the one place that number lives.
 *
 * The CSS transition on `[data-removing]` runs for `--builder-motion-page`;
 * this is the same duration in the one unit JavaScript can wait in. They have
 * to agree, because the delete request is raced against it: whichever finishes
 * last decides when the shelf closes up.
 */
const REMOVE_MS = 240;

/**
 * FLIP, so the gap left by a deleted course closes instead of teleporting.
 *
 * Grid and flex reflow is not animatable — there is no transition between two
 * layouts, only the second one. FLIP gets around that without owning the
 * layout: read where every item was on the previous commit, read where it is
 * now, and if it moved, play it from the old position back to the new one with
 * a transform. The layout is already correct the entire time; the transform is
 * a lie told for 260ms about where the browser has finished putting things.
 *
 * `useLayoutEffect`, not `useEffect`: the measurement has to happen before the
 * browser paints the new positions, or the reader sees the jump this exists to
 * hide and then sees it animate a second time.
 *
 * Items are matched by `data-flip-key` rather than by index, so a deletion in
 * the middle moves the cards that actually moved instead of shifting every key
 * by one. Anything mid-leave is skipped — it is running its own animation in
 * place and has not moved.
 *
 * `resetKey` is the one thing this must NOT animate. Switching grid↔rows moves
 * every card by hundreds of pixels, and playing that back is not a shelf
 * closing a gap — it is one layout flying into another, which reads as chaos
 * and says nothing. When the key changes the run measures and records without
 * animating, so the new view starts from a clean baseline.
 */
function useShelfReflow(resetKey: string, deps: unknown[]) {
  const container = useRef<HTMLDivElement & HTMLUListElement>(null);
  const lastRects = useRef(new Map<string, DOMRect>());
  const lastResetKey = useRef(resetKey);

  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;

    const reduced =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rebased = lastResetKey.current !== resetKey;
    lastResetKey.current = resetKey;

    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-flip-key]"));
    const nextRects = new Map<string, DOMRect>();

    for (const item of items) {
      const key = item.dataset.flipKey;
      if (!key) continue;
      const rect = item.getBoundingClientRect();
      nextRects.set(key, rect);

      if (reduced || rebased || item.hasAttribute("data-removing")) continue;

      const previous = lastRects.current.get(key);
      if (!previous) continue;

      const dx = previous.left - rect.left;
      const dy = previous.top - rect.top;
      // Sub-pixel drift is not movement; animating it would fire an animation
      // on every card on every reload.
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;

      item.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
        { duration: 260, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" },
      );
    }

    lastRects.current = nextRects;
    // The caller passes the list identity and the removal in flight; this hook
    // has no opinion about what makes the shelf change shape.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, ...deps]);

  return container;
}

export function BuilderCourseList() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const stored = useSyncExternalStore(subscribeToView, readView, () => "rows" as CourseView);
  // Server-side and on a phone: rows. The card grid is only ever a choice where
  // there is width for it.
  const wide = useSyncExternalStore(subscribeToWidth, () => window.matchMedia(WIDE).matches, () => false);
  const view: CourseView = wide ? stored : "rows";
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  /* The course that is on its way out. It stays in `state.courses` — and so on
     screen — for as long as this is set, which is what gives the leaving
     something to play on. */
  const [removing, setRemoving] = useState<string | null>(null);
  /* Both views hang this off the same ref — only one of them is mounted at a
     time, and the hook re-measures from scratch whenever `view` changes, so
     switching grid↔rows is a fresh baseline rather than a false «everything
     moved». */
  const shelf = useShelfReflow(view, [state, removing]);

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

  async function create() {
    if (busy) return;
    setBusy(true);
    setCreating(true);
    setNote(null);
    const result = await createCourse();
    setBusy(false);
    if (!result.ok) {
      setCreating(false);
      setNote(result.detail ?? "Не вдалося створити курс.");
      return;
    }
    router.push(`/build/${result.data.slug}`);
  }

  async function remove(slug: string) {
    if (busy) return;
    setBusy(true);
    setNote(null);
    /* The question is answered, so it goes at once — leaving it up while the
       card fades underneath it would be asking twice. The card starts leaving
       now, BEFORE the request, because the answer to «which one» has to be on
       screen at the moment the reader commits, not after the server agrees. */
    setConfirmingDelete(null);
    setRemoving(slug);

    const startedAt = performance.now();
    const result = await deleteCourse(slug);

    if (!result.ok) {
      /* Nothing was destroyed, so nothing may disappear: the flag clears and
         the card transitions back from wherever it had got to. */
      setRemoving(null);
      setBusy(false);
      setNote(deleteFailureCopy(result.detail));
      return;
    }

    /* A fast delete would otherwise unmount the card mid-fade and turn the
       whole sequence back into the jump it replaces. A slow one has already
       outlasted the animation and waits for nothing. */
    const remaining = REMOVE_MS - (performance.now() - startedAt);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));

    await load();
    setRemoving(null);
    setBusy(false);
  }

  async function exportOne(slug: string) {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const result = await exportCourseFile(slug);
    setBusy(false);
    if (!result.ok) {
      setNote(result.detail ?? "Не вдалося експортувати курс.");
      return;
    }

    const url = URL.createObjectURL(new Blob([result.data.text], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = result.data.filename;
    link.click();
    URL.revokeObjectURL(url);
    setNote(`Експортовано ${result.data.filename}`);
  }

  if (state.status === "loading") {
    return (
      <BuilderShell>
        <PlatformLoadingState label="Майстерня" title="Завантажуємо ваші курси…" detail="Відновлюємо чернетки, статуси й обкладинки." />
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

  if (creating) {
    return (
      <BuilderShell trail={[{ label: "Курси", href: "/build" }, { label: "Новий курс" }]}>
        <PlatformLoadingState label="Майстерня" title="Створюємо чернетку…" detail="Після створення одразу відкриється редактор курсу." />
      </BuilderShell>
    );
  }

  return (
    <BuilderShell>
      {/* The platform's page head, the same component the learner's shelf runs.
          The two pages are one shelf seen from two sides — the courses you may
          read and the courses you may edit — and they were opening differently
          enough that the top of the page did not say which side you were on:
          this one had no application label at all, a title a size larger, and
          two wide text buttons where the shelf had nothing.

          THE ACTIONS ARE ICONS NOW. They act on the LIST, and the list already
          carries a bar of icon controls a few lines below (the view switch), so
          two full-width words above it made the head read as the loudest thing
          on a page whose subject is the courses. Both keep a tooltip and an
          accessible name — an icon-only control that says nothing is a rebus. */}
      {/* NO LEAD HERE, and the shelf keeps its own. Four statements about one
          list were stacked at the top of this page — the application
          («Майстерня»), the page («Курси»), the sentence («доступні вам для
          редагування») and the count («9 курсів») — and the third is the one
          that adds nothing: «available to you for editing» is what Майстерня
          MEANS. The learner's shelf keeps its lead because there the sentence
          carries a fact the title cannot («відкриваються з того уроку, на якому
          ви зупинились»). */}
      <PlatformPageHead
        label="Майстерня"
        title="Курси"
        actions={
          state.canCreate ? (
            <>
              {!importing ? (
                <button
                  className={styles.headIconAction}
                  type="button"
                  title="Імпортувати JSON"
                  onClick={() => {
                    setCreating(false);
                    setImporting(true);
                  }}
                >
                  <Icon name="import" size={20} label="Імпортувати JSON" />
                  <HandGraphic className={styles.iconInkRing} name="ink-ring" size={42} />
                </button>
              ) : null}
              {!creating ? (
                <button
                  className={styles.headPrimaryIconAction}
                  type="button"
                  title={busy ? "Створюємо…" : "Новий курс"}
                  onClick={() => {
                    setImporting(false);
                    void create();
                  }}
                  disabled={busy}
                >
                  <Icon name="plus" size={20} label={busy ? "Створюємо…" : "Новий курс"} />
                </button>
              ) : null}
            </>
          ) : null
        }
      />

      {/* A SHEET, NOT A ROW IN THE PAGE. Dropped into the flow this panel shoved
          the whole shelf down by its own height — every card moved, and the one
          you were looking at was somewhere else by the time the form appeared.
          It is also a task you enter deliberately, finish, and leave, which is
          exactly what `BuilderSheet` is for: the same object the version history
          opens in, with the scrim and the focus trap that say the list behind is
          not what you are working on.

          The children unmount with it on purpose — that is what resets a
          half-picked file, so opening the form twice does not show the first
          attempt's filename. */}
      <BuilderSheet
        open={state.canCreate && importing}
        title="Імпорт курсу"
        onClose={() => setImporting(false)}
      >
        {state.canCreate && importing ? (
          <ImportPanel
            onCancel={() => setImporting(false)}
            onImported={async (slug) => {
              setImporting(false);
              setNote(`Курс імпортовано як чернетку: ${slug}`);
              await load();
            }}
          />
        ) : null}
      </BuilderSheet>

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
        <div className={styles.courseGrid} ref={shelf}>
          {state.courses.map((course, index) => (
            <CourseCard
              key={course.slug}
              course={course}
              index={index}
              total={state.courses.length}
              busy={busy}
              confirming={confirmingDelete === course.slug}
              removing={removing === course.slug}
              onMove={move}
              onAskDelete={setConfirmingDelete}
              onDelete={remove}
              onExport={exportOne}
            />
          ))}
        </div>
      ) : (
        <ul className={styles.courseRows} ref={shelf}>
          {state.courses.map((course, index) => (
            <CourseRow
              key={course.slug}
              course={course}
              index={index}
              total={state.courses.length}
              busy={busy}
              confirming={confirmingDelete === course.slug}
              removing={removing === course.slug}
              onMove={move}
              onAskDelete={setConfirmingDelete}
              onDelete={remove}
              onExport={exportOne}
            />
          ))}
        </ul>
          )}
        </>
      )}
    </BuilderShell>
  );
}

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

type ImportState =
  | { status: "empty" }
  | { status: "checking"; filename: string }
  | { status: "failed"; message: string }
  | { status: "ready"; filename: string; course: unknown; preview: CourseImportPreview }
  | { status: "committing"; filename: string; course: unknown; preview: CourseImportPreview };

/** A two-step boundary: inspect first, write only after explicit confirmation. */
function ImportPanel({ onCancel, onImported }: { onCancel: () => void; onImported: (slug: string) => void }) {
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

function ViewSwitch({ view, onChange }: { view: CourseView; onChange: (next: CourseView) => void }) {
  return (
    <div className={styles.viewSwitch} role="group" aria-label="Вигляд списку">
      {/* Glyphs now, and they exist: `view-rows` / `view-cards` were added to
          the baked set for exactly this control (scripts/lib/icon-glyphs.mjs).
          Words were a stand-in for the set not having them — the earlier note
          here was right that `menu` and the dot/orbit layer both meant something
          else, and the answer to a missing glyph is to draw it, not to set a
          toolbar in prose.

          The label survives as the accessible name and as the tooltip: a
          two-state icon switch is unreadable to a screen reader without one, and
          the pointer user gets the same word on hover. */}
      <button
        className={styles.viewOption}
        type="button"
        aria-pressed={view === "rows"}
        title="Рядки"
        onClick={() => onChange("rows")}
      >
        <Icon name="view-rows" size={20} label="Рядки" />
        <HandGraphic className={styles.iconInkRing} name="ink-ring" size={42} />
      </button>
      <button
        className={styles.viewOption}
        type="button"
        aria-pressed={view === "grid"}
        title="Картки"
        onClick={() => onChange("grid")}
      >
        <Icon name="view-cards" size={20} label="Картки" />
        <HandGraphic className={styles.iconInkRing} name="ink-ring" size={42} />
      </button>
    </div>
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
function CourseRow(props: EntryProps) {
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
    <article
      className={styles.courseCard}
      data-flip-key={course.slug}
      data-removing={props.removing || undefined}
      {...courseThemeAttributes(course.theme ?? undefined)}
    >
      <Link className={styles.courseCardFace} href={`/build/${course.slug}`}>
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
            style={{ objectPosition: `${course.cover.cropX ?? 50}% ${course.cover.cropY ?? 50}%` }}
          />
        ) : (
          // Not a grey box: a course with no cover still has a palette, and the
          // initials on it are enough to tell two cards apart at a glance.
          <span className={styles.courseCoverFallback} aria-hidden="true">
            {initialsOf(course.title)}
          </span>
        )}
        <span className={styles.courseCardBody}>
          <span className={styles.courseTitleRow}>
            {/* No mark inside the title: the card's own contour carries it —
                see the note beside `.courseCard::after`. An underline measures
                a label; the thing under the pointer here is the whole card. */}
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
function EntryControls({ course, index, total, busy, confirming, onMove, onAskDelete, onDelete, onExport }: EntryProps) {
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) cancelDeleteRef.current?.focus();
  }, [confirming]);

  if (confirming) {
    return (
      <div
        className={styles.confirmRow}
        role="group"
        aria-label={`Підтвердження видалення курсу «${course.title}»`}
        onKeyDown={(event) => {
          if (event.key === "Escape") onAskDelete(null);
        }}
      >
        <span className={styles.confirmText} title={course.title}>Видалити курс?</span>
        <button
          ref={cancelDeleteRef}
          className={styles.quietAction}
          type="button"
          onClick={() => onAskDelete(null)}
          disabled={busy}
        >
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
          label: "Експортувати JSON",
          hint: "Завантажити переносимий знімок поточної версії курсу",
          onSelect: () => onExport(course.slug),
          disabled: busy,
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
