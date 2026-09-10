"use client";

import { useToast } from "@/components/ToastProvider";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { moveItem } from "@/lms-core";
import { BuilderFailureNotice, BuilderNotice, BuilderShell } from "./BuilderShell";
import { BuilderSheet } from "./BuilderSheet";
import { Icon } from "@/components/Icon";
import { InteractionInkIcon } from "@/components/platform/InteractionInk";
import { createCourse, deleteCourse, exportCourseFile, listCourses, reorderCourses, unpublishCourse, type BuilderCourseSummary, type BuilderFailure } from "./builderClient";
import styles from "./Builder.module.css";
import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";
import { PlatformPageHead } from "@/components/platform/PlatformPageHead";
import { getCabinetCopy } from "@/components/platform/cabinet/copy";
import { EMPTY_SHELF_QUERY, ShelfFilter, isShelfQueryEmpty, matchesShelfQuery, type ShelfQuery } from "@/components/platform/cabinet/ShelfFilter";
import filterStyles from "@/components/platform/cabinet/ShelfFilter.module.css";
import { ShelfResultBar } from "@/components/platform/cabinet/ShelfPresentation";
import { CourseCard, CourseRow, ViewSwitch, deleteFailureCopy, unpublishFailureCopy } from "./BuilderCourseEntry";
import { ImportPanel } from "./BuilderImportPanel";
import { REMOVE_MS, VIEW_EVENT, VIEW_KEY, readView, subscribeToView, type CourseView, useShelfReflow } from "./builderShelfView";

const SHELF_COPY = getCabinetCopy("uk");

type State =
  | { status: "loading" }
  | { status: "failed"; failure: BuilderFailure; detail?: string }
  | { status: "ready"; courses: BuilderCourseSummary[]; isAdmin: boolean; canCreate: boolean };

/** The two release-affecting actions a shelf entry can ask to confirm. */
export type PendingKind = "delete" | "unpublish";

/**
 * The shelf's one notification slot: a question, or the server's answer to it,
 * always addressed to exactly one course. `error` only ever follows a
 * `confirm` on the same slug — see `EntryControls`, which renders both phases
 * in the identical footprint the confirmation opened.
 */
export type PendingAction =
  | { slug: string; kind: PendingKind; phase: "confirm" }
  | { slug: string; kind: PendingKind; phase: "error"; message: string };

export function BuilderCourseList() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const view = useSyncExternalStore(subscribeToView, readView, () => "rows" as CourseView);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  /**
   * ONE PENDING ACTION AT A TIME, ONE PLACE IT IS SHOWN.
   *
   * `confirm` and `error` are the same box in the same spot on the same card —
   * see `EntryControls` — because a refusal is the answer to the question that
   * was just asked there, not a separate event. The alternative this replaces
   * was a page-level `note` string: it put "курс уже проходили учні" in a line
   * above the shelf while the card someone had just tried to delete sat three
   * screens down, so the one sentence that explained the refusal was never
   * where the eye already was.
   */
  const [pending, setPending] = useState<PendingAction | null>(null);
  /* Asked once, not remembered: see the same note on the learner's shelf. */
  const [query, setQuery] = useState<ShelfQuery>(EMPTY_SHELF_QUERY);
  const filtering = !isShelfQueryEmpty(query);
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
    const result = await reorderCourses(next.map((course) => course.slug));
    setBusy(false);
    if (!result.ok) {
      toast.error(result.detail ?? "Не вдалося зберегти порядок.");
      await load();
    }
  }

  async function create() {
    if (busy) return;
    setBusy(true);
    setCreating(true);
    const result = await createCourse();
    setBusy(false);
    if (!result.ok) {
      setCreating(false);
      toast.error(result.detail ?? "Не вдалося створити курс.");
      return;
    }
    router.push(`/build/${result.data.slug}`);
  }

  /** Opens the confirm phase — the only way `pending` ever gains a slug. */
  function askPending(slug: string, kind: PendingKind) {
    if (busy) return;
    setPending({ slug, kind, phase: "confirm" });
  }

  /** «Ні» on a question, or «Зрозуміло» on its refusal — both just close the slot. */
  function dismissPending() {
    setPending(null);
  }

  async function remove(slug: string, courseStatus: BuilderCourseSummary["status"]) {
    if (busy) return;
    setBusy(true);
    /* The question is answered, so it goes at once — leaving it up while the
       card fades underneath it would be asking twice. The card starts leaving
       now, BEFORE the request, because the answer to «which one» has to be on
       screen at the moment the reader commits, not after the server agrees. */
    setPending(null);
    setRemoving(slug);

    const startedAt = performance.now();
    const result = await deleteCourse(slug);

    if (!result.ok) {
      /* Nothing was destroyed, so nothing may disappear: the flag clears and
         the card transitions back from wherever it had got to. The refusal
         reopens in the same slot the question used — on THIS course, not as a
         line at the top of a shelf the reader may have scrolled away from. */
      setRemoving(null);
      setBusy(false);
      setPending({
        slug,
        kind: "delete",
        phase: "error",
        message: deleteFailureCopy(courseStatus, result.detail),
      });
      return;
    }

    /* A fast delete would otherwise unmount the card mid-fade and turn the
       whole sequence back into the jump it replaces. A slow one has already
       outlasted the animation and waits for nothing. */
    const remaining = REMOVE_MS - (performance.now() - startedAt);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));

    /* THE GAP CLOSES THE MOMENT THE CARD IS GONE, NOT AFTER A SECOND ROUND
       TRIP (2026-08-29). This used to `await load()` here — a full refetch —
       before the course left `state.courses`. The delete had already
       succeeded and the fade had already finished, so for however long that
       refetch took, the shelf held an invisible card open in its grid cell:
       the neighbours had nothing left to close up around, because as far as
       React knew the course was still there. That is the reflow `useShelfReflow`
       promises "after the item is gone" — it just was not gone yet.

       Removed here, locally, the moment the network confirms it — which is
       also the moment `useShelfReflow`'s effect can see it missing and animate
       the gap shut in the same frame the DOM drops the node.

       `load()` still runs, just after and unawaited: nothing about the OTHER
       courses changed, but `canCreate` can (`canCreateCourse` gates a
       non-admin on owning at least one), and that one flag is worth a quiet
       background reconcile rather than blocking the shelf on it. */
    setState((current) =>
      current.status === "ready"
        ? { ...current, courses: current.courses.filter((entry) => entry.slug !== slug) }
        : current
    );
    setRemoving(null);
    setBusy(false);
    void load();
  }

  /**
   * The shelf's own «Зняти з публікації» — the same act the release workspace
   * already offers, reached without opening the course. Reversible, and it
   * takes nothing from anyone already enrolled (`src/lib/lms/server.ts` keeps
   * an active learner's access regardless of `status`); it only stops new
   * enrolment and catalogue visibility. That is why it asks once and plainly,
   * not in the boundary tone delete uses.
   */
  async function unpublish(slug: string) {
    if (busy) return;
    setBusy(true);
    setPending(null);
    const result = await unpublishCourse(slug);
    setBusy(false);
    if (!result.ok) {
      setPending({ slug, kind: "unpublish", phase: "error", message: unpublishFailureCopy(result) });
      return;
    }
    /* THE SAME FIX AS `remove` (2026-08-29), for the same reason: the write
       already confirmed the new status, so waiting on a second full fetch
       before the pill updates leaves the card lying — «Опубліковано» sits on
       a course that was just taken off the shelf, for however long that fetch
       takes. Nothing else about the row changes on an unpublish (blockers and
       counts are unaffected), so the local flip is the whole truth already;
       `load()` runs after, unawaited, for the same `canCreate` reason `remove`
       keeps it around for. */
    setState((current) =>
      current.status === "ready"
        ? {
            ...current,
            courses: current.courses.map((entry) =>
              entry.slug === slug ? { ...entry, status: result.data.status } : entry
            ),
          }
        : current
    );
    void load();
  }

  function confirmPending() {
    if (!pending || pending.phase !== "confirm") return;
    if (pending.kind === "delete") {
      /* The status the shelf is showing, so a refusal can say the one true
         thing about THIS course rather than the union of every rule. */
      const status =
        state.status === "ready"
          ? state.courses.find((course) => course.slug === pending.slug)?.status ?? "draft"
          : "draft";
      void remove(pending.slug, status);
    } else void unpublish(pending.slug);
  }

  async function exportOne(slug: string) {
    if (busy) return;
    setBusy(true);
    const result = await exportCourseFile(slug);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.detail ?? "Не вдалося експортувати курс.");
      return;
    }

    const url = URL.createObjectURL(new Blob([result.data.text], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = result.data.filename;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Експортовано ${result.data.filename}`);
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

  /* The entries the query leaves standing, each carrying the index it has in the
     WHOLE shelf — see the note beside the filter for why that index has to be
     the real one. Not a hook: it is derived from state that is only narrowed to
     "ready" after the guards above, and it costs one pass over a handful of
     rows. */
  const shown = state.courses
    .map((course, index) => ({ course, index }))
    .filter(({ course }) => !filtering || matchesShelfQuery(course, query, SHELF_COPY));

  return (
    <BuilderShell>
      {/* The platform's page head, the same component the learner's shelf runs.
          The two pages are one shelf seen from two sides — the courses you may
          read and the courses you may edit — and they were opening differently
          enough that the top of the page did not say which side you were on:
          this one had no application label at all, a title a size larger, and
          two wide text buttons where the shelf had nothing.

          Creation remains the sole labelled primary action. Import is a
          secondary utility and therefore uses the shared icon-only control. */}
      <PlatformPageHead
        label="Майстерня"
        title="Матеріали"
        lead="Створюйте, редагуйте та публікуйте навчальні матеріали."
        actions={
          state.canCreate ? (
            <>
              {!importing ? (
                <button
                  className={styles.headImportAction}
                  type="button"
                  data-cw-ink-control
                  aria-label="Імпортувати курс"
                  title="Імпортувати курс"
                  onClick={() => {
                    setCreating(false);
                    setImporting(true);
                  }}
                >
                  <InteractionInkIcon>
                    <Icon name="import" size={18} aria-hidden="true" />
                  </InteractionInkIcon>
                </button>
              ) : null}
              {!creating ? (
                <button
                  className={styles.headPrimaryAction}
                  type="button"
                  onClick={() => {
                    setImporting(false);
                    void create();
                  }}
                  disabled={busy}
                >
                  <Icon name="plus" size={18} aria-hidden="true" />
                  {busy ? "Створюємо…" : "Новий курс"}
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
              toast.success(`Курс імпортовано як чернетку: ${slug}`);
              await load();
            }}
          />
        ) : null}
      </BuilderSheet>


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
          {/* THE SHELF IS FILTERED, NOT REORDERED. Every entry below keeps the
              `index` it has in the WHOLE list, and the entries the query left
              out are simply not rendered — because `index` is what
              «Підняти вище» moves, and an index counted within a filtered view
              would move a course past neighbours the author cannot see. While a
              query is running, reordering is off for the same reason: order is
              a property of the whole shelf, and it cannot honestly be edited
              through a keyhole. */}
          {state.courses.length > 1 ? (
            <ShelfFilter
              query={query}
              onChange={setQuery}
              copy={SHELF_COPY}
              categories={Array.from(new Set(state.courses.flatMap((course) => course.categories)))}
            />
          ) : null}
          <ShelfResultBar
            label="Матеріали"
            filtering={filtering}
            /* Counted off `filtering`, not off whether the filter happened
               to keep everything: the library says «3 з 9» whenever a query
               is active, and a filter that matches all nine is still a
               narrowed shelf. Two sides of one shelf, one sentence. */
            count={
              filtering
                ? `${shown.length} з ${state.courses.length}`
                : SHELF_COPY.materialsCount(state.courses.length)
            }
          >
            <ViewSwitch view={view} onChange={chooseView} />
          </ShelfResultBar>
          {shown.length === 0 ? (
            <p className={filterStyles.noMatch}>{SHELF_COPY.shelfNoMatch}</p>
          ) : view === "grid" ? (
        <div className={styles.courseGrid} ref={shelf}>
          {shown.map(({ course, index }) => (
            <CourseCard
              key={course.slug}
              course={course}
              index={index}
              total={state.courses.length}
              reorderable={!filtering}
              busy={busy}
              pending={pending && pending.slug === course.slug ? pending : null}
              removing={removing === course.slug}
              onMove={move}
              onAsk={askPending}
              onCancel={dismissPending}
              onConfirm={confirmPending}
              onExport={exportOne}
            />
          ))}
        </div>
      ) : (
        <ul className={styles.courseRows} ref={shelf}>
          {shown.map(({ course, index }) => (
            <CourseRow
              key={course.slug}
              course={course}
              index={index}
              total={state.courses.length}
              reorderable={!filtering}
              busy={busy}
              pending={pending && pending.slug === course.slug ? pending : null}
              removing={removing === course.slug}
              onMove={move}
              onAsk={askPending}
              onCancel={dismissPending}
              onConfirm={confirmPending}
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
/** What the confirm phase asks, and the button that answers yes — per kind. */
export const PENDING_COPY: Record<PendingKind, { question: string; commitLabel: string; commitDanger?: boolean }> = {
  delete: { question: "Видалити курс?", commitLabel: "Видалити", commitDanger: true },
  unpublish: { question: "Зняти курс з публікації?", commitLabel: "Зняти" },
};
