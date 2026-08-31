"use client";

/**
 * The learner's shelf, at `/learn`.
 *
 * It used to be a tab inside the profile, reachable only as `/profile#learning`
 * — a hash pretending to be a route. That cost more than tidiness: the browser
 * back button did not step through it, the section could not be prefetched, and
 * the URL tree lied, since `/learn/<course>/<lesson>` existed while `/learn`
 * did not. Chopping a segment off a lesson link landed on a 404 that read as
 * "my course is gone".
 *
 * Now it is the index of its own tree, and it is where a buyer lands: the
 * installed app starts here, the bot links here, and the header's first entry
 * points here. The profile is what it says on the tin — the account.
 */

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

import type { CourseCategory } from "@/lms-core";
import surfaceStyles from "@/components/platform/PlatformSurfaceStyles";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import { cabinetGate } from "./CabinetGate";
import { CourseCard, CourseRow, ShelfEmptyCard, ShelfErrorCard } from "./CourseCard";
import { LearnRoomView } from "./LearnRoomView";
import {
  EMPTY_SHELF_QUERY,
  ShelfFilter,
  isShelfQueryEmpty,
  matchesShelfQuery,
  type ShelfQuery,
} from "./ShelfFilter";
import filterStyles from "./ShelfFilter.module.css";
import { dateLocaleFor } from "./format";
import { getCabinetCopy } from "./copy";
import { useCabinetSession, useLearnerShelf, useProfileLang } from "./useCabinet";
import styles from "./Cabinet.module.css";
import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";
import { PlatformPageHead } from "@/components/platform/PlatformPageHead";
import { ShelfPresentation, ShelfResultBar } from "./ShelfPresentation";


/**
 * TWO SHAPES OF ONE SHELF, and the reader picks (2026-08-28).
 *
 * A card is the course as an OBJECT — its picture, its state, its window. A row
 * is the course as an ENTRY. Both are right, for different questions: «which of
 * these do I feel like opening» wants pictures, «where is the one I own» wants
 * a list. On a phone the difference is also seven screens against one and a
 * half, which is why the switch is here and not only on a desk.
 *
 * Stored per device, not per account: it is a preference about this screen in
 * this hand, and it survives a reload the way the builder's own view switch
 * does — the same `localStorage` + `useSyncExternalStore` shape, so two tabs of
 * the shelf never disagree about what they are showing.
 */
/* "room" joins the two flat shapes as a third answer to the same question:
   the shelf as a SPACE — courses grouped by what they are about, the way a
   library groups by category rather than by acquisition date. See
   LearnRoomView.tsx for what it does and, as importantly, does not yet do. */
type ShelfView = "cards" | "rows" | "room";
const SHELF_VIEW_KEY = "cw.shelf.view";
const SHELF_VIEW_EVENT = "cw:shelf-view";

function subscribeToShelfView(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(SHELF_VIEW_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SHELF_VIEW_EVENT, onChange);
  };
}

function readShelfView(): ShelfView {
  const raw = window.localStorage.getItem(SHELF_VIEW_KEY);
  return raw === "rows" || raw === "room" ? raw : "cards";
}

export function LearnShelfClient() {
  const lang = useProfileLang();
  const { session, loading, signInWithGoogle } = useCabinetSession();
  const { shelf, failed, reload } = useLearnerShelf(session);

  const cab = useMemo(() => getCabinetCopy(lang), [lang]);
  const dateLocale = dateLocaleFor(lang);

  /* `"cards"` as the server snapshot: it is the default, so the first client
     render agrees with the markup and a reader who chose rows sees them from
     the first frame after hydration rather than a card that jumps. */
  const view = useSyncExternalStore(subscribeToShelfView, readShelfView, () => "cards" as ShelfView);
  const chooseView = (next: ShelfView) => {
    window.localStorage.setItem(SHELF_VIEW_KEY, next);
    window.dispatchEvent(new Event(SHELF_VIEW_EVENT));
  };

  /* THE QUERY IS NOT REMEMBERED, and the view is — the difference is what each
     one is about. Which shape the shelf takes is a standing preference about
     this screen in this hand; a search is a question asked once, and a shelf
     that opens tomorrow already narrowed to «детокс» is a shelf that has lost
     courses. */
  const [query, setQuery] = useState<ShelfQuery>(EMPTY_SHELF_QUERY);
  const filtering = !isShelfQueryEmpty(query);
  const match = useCallback(
    (course: { title: string; categories: readonly CourseCategory[] }) =>
      matchesShelfQuery(course, query, cab),
    [query, cab]
  );
  /* The flat views take the narrowed list; only the room takes the predicate. */
  const visible = useMemo(
    () => (filtering && shelf ? shelf.filter(match) : shelf ?? []),
    [filtering, shelf, match]
  );

  const href = useSurfaceHref();
  const programsHref = href("/programs");
  const homeHref = href("/");

  /* Loading states answer only «the current content is loading». They must not
     preview the page's eventual title: Builder already uses this exact shared
     loading state, and a library heading above it made one route look like a
     page while the other still looked like a transition. */
  const shelfLoading = (
    <main className={surfaceStyles.profileMain} data-cw-platform-template="loading">
      <div className={styles.shell}>
        <PlatformLoadingState
          label={cab.learningLabel}
          title={cab.learningLoadingTitle}
          detail={cab.learningLoadingLead}
        />
      </div>
    </main>
  );

  const gate = cabinetGate({
    lang,
    loading,
    session,
    homeHref,
    onSignIn: () => void signInWithGoogle(),
    loadingFallback: shelfLoading,
  });
  if (gate) return gate;

  if (!failed && shelf === null) {
    return shelfLoading;
  }

  return (
    <main className={surfaceStyles.profileMain} data-cw-platform-template="shelf">
      <div className={styles.shell}>
        {/* The shared head, not this file's own section scaffolding: the shelf
            and the builder's course list are the same page in two applications,
            and they were disagreeing about the size of their titles and about
            whether a list says anything about itself at all. There are no
            actions here — nothing on this page acts on the shelf as a whole;
            everything you can do, you do to one course. */}
        <PlatformPageHead label={cab.learningLabel} title={cab.learningTitle} lead={cab.learningLead} />

        <div className={styles.section}>
          {failed ? <ShelfErrorCard copy={cab} onRetry={() => void reload()} /> : null}
          {shelf && shelf.length > 0 ? (
            <>
              {/* Shown only when there is more than one course: a switch between
                  two views of a single entry is a control with nothing to do. */}
              {/* THE FILTER COMES BEFORE THE SWITCH, because it changes WHAT is
                  on the shelf and the switch only changes how it is drawn. It
                  appears on the same condition the switch does: one course
                  needs neither narrowing nor a choice of shapes. */}
              {shelf.length > 1 ? (
                <ShelfFilter
                  query={query}
                  onChange={setQuery}
                  copy={cab}
                  categories={Array.from(new Set(shelf.flatMap((course) => course.categories)))}
                />
              ) : null}
              {/* The count is orientation, not a condition for choosing a
                  representation. A one-item shelf still says what it holds;
                  only the view switch disappears when it would have nothing
                  meaningful to change. */}
              <ShelfResultBar
                label={cab.materialsLabel}
                filtering={filtering}
                count={filtering ? `${visible.length} з ${shelf.length}` : cab.materialsCount(shelf.length)}
              >
                {shelf.length > 1 ? (
                  <ShelfPresentation
                    label={cab.shelfViewLabel}
                    value={view}
                    onChange={chooseView}
                    options={[
                      { value: "cards", label: cab.shelfViewCards, icon: "view-cards" },
                      { value: "rows", label: cab.shelfViewRows, icon: "view-rows" },
                      { value: "room", label: cab.shelfViewRoom, icon: "stone" },
                    ]}
                  />
                ) : (
                  <span aria-hidden="true" />
                )}
              </ShelfResultBar>
              {view === "room" ? (
                /* The room takes the PREDICATE, not the narrowed list: its wall
                   is laid out from every course and only dims what the query
                   left out. See `LearnRoomView`'s own note on why. */
                /* And the CATEGORY, because the room's camera and the subject
                   chips above it are one choice: walking up to a shelf presses
                   that chip, and «All» is the way back to the middle of the
                   room. Owned here rather than in the room for the same reason
                   the query is — the chips are the control, the wall is one of
                   the things that answers it. */
                <LearnRoomView
                  courses={shelf}
                  copy={cab}
                  match={filtering ? match : undefined}
                  category={query.category}
                  onCategory={(next) => setQuery((prev) => ({ ...prev, category: next }))}
                />
              ) : visible.length === 0 ? (
                <p className={filterStyles.noMatch}>{cab.shelfNoMatch}</p>
              ) : (
                <div className={styles.cardGrid} data-view={view}>
                  {visible.map((course) =>
                    view === "rows" ? (
                      <CourseRow key={course.slug} course={course} copy={cab} />
                    ) : (
                      <CourseCard key={course.slug} course={course} copy={cab} dateLocale={dateLocale} />
                    )
                  )}
                </div>
              )}
            </>
          ) : failed ? null : shelf ? (
            <ShelfEmptyCard copy={cab} programsHref={programsHref} />
          ) : null}
        </div>

        {/* NO INSTALL ROW HERE. This origin's root is what an install actually
            adds, so the offer does belong on this side — but this tree renders
            `footer={false}`, and a full-width line under the last course read as
            a footer that had lost its footer. It moved into the account menu
            this page already carries; see `InstallEntry` in
            `layout/PlatformAccountMenu.tsx`. */}
      </div>
    </main>
  );
}
