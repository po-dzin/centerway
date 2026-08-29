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

import { useMemo, useSyncExternalStore } from "react";

import surfaceStyles from "@/components/platform/PlatformSurfaceStyles";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import { cabinetGate } from "./CabinetGate";
import { CourseCard, CourseRow, ShelfEmptyCard, ShelfErrorCard } from "./CourseCard";
import { LearnRoomView } from "./LearnRoomView";
import { dateLocaleFor } from "./format";
import { getCabinetCopy } from "./copy";
import { useCabinetSession, useLearnerShelf, useProfileLang } from "./useCabinet";
import styles from "./Cabinet.module.css";
import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";
import { PlatformPageHead } from "@/components/platform/PlatformPageHead";
import { Icon } from "@/components/Icon";


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

  const href = useSurfaceHref();
  const programsHref = href("/programs");
  const homeHref = href("/");

  const gate = cabinetGate({
    lang,
    loading,
    session,
    homeHref,
    onSignIn: () => void signInWithGoogle(),
    loadingCopy: {
      label: cab.learningLabel,
      title: cab.learningLoadingTitle,
      lead: cab.learningLoadingLead,
    },
  });
  if (gate) return gate;

  if (!failed && shelf === null) {
    return (
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
              {shelf.length > 1 ? (
                <div className={styles.viewSwitch} role="group" aria-label={cab.shelfViewLabel}>
                  <button
                    className={styles.viewOption}
                    type="button"
                    aria-label={cab.shelfViewCards}
                    aria-pressed={view === "cards"}
                    onClick={() => chooseView("cards")}
                  >
                    <Icon name="view-cards" size={18} />
                  </button>
                  <button
                    className={styles.viewOption}
                    type="button"
                    aria-label={cab.shelfViewRows}
                    aria-pressed={view === "rows"}
                    onClick={() => chooseView("rows")}
                  >
                    <Icon name="view-rows" size={18} />
                  </button>
                  <button
                    className={styles.viewOption}
                    type="button"
                    aria-label={cab.shelfViewRoom}
                    aria-pressed={view === "room"}
                    onClick={() => chooseView("room")}
                  >
                    <Icon name="stone" size={18} />
                  </button>
                </div>
              ) : null}
              {view === "room" ? (
                <LearnRoomView courses={shelf} copy={cab} />
              ) : (
                <div className={styles.cardGrid} data-view={view}>
                  {shelf.map((course) =>
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
