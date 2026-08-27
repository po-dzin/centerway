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

import { useMemo } from "react";

import surfaceStyles from "@/components/platform/PlatformSurfaceStyles";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import { cabinetGate } from "./CabinetGate";
import { CourseCard, ShelfEmptyCard, ShelfErrorCard } from "./CourseCard";
import { dateLocaleFor } from "./format";
import { getCabinetCopy } from "./copy";
import { useCabinetSession, useLearnerShelf, useProfileLang } from "./useCabinet";
import styles from "./Cabinet.module.css";
import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";
import { PlatformPageHead } from "@/components/platform/PlatformPageHead";

export function LearnShelfClient() {
  const lang = useProfileLang();
  const { session, loading, signInWithGoogle } = useCabinetSession();
  const { shelf, failed, reload } = useLearnerShelf(session);

  const cab = useMemo(() => getCabinetCopy(lang), [lang]);
  const dateLocale = dateLocaleFor(lang);

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
            <div className={styles.cardGrid}>
              {shelf.map((course) => (
                <CourseCard key={course.slug} course={course} copy={cab} dateLocale={dateLocale} />
              ))}
            </div>
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
