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
import { usePlatformHref } from "@/components/platform/layout/usePlatformHref";
import { builderHref, useAuthoringAccess } from "@/components/platform/AuthorEntry";
import { getProfileCopy } from "@/components/platform/profile/copy";
import { cabinetGate } from "./CabinetGate";
import { CourseCard, ShelfEmptyCard, ShelfErrorCard, matte } from "./CourseCard";
import { dateLocaleFor } from "./format";
import { getCabinetCopy } from "./copy";
import { useCabinetSession, useLearnerShelf, useProfileLang } from "./useCabinet";
import styles from "./Cabinet.module.css";

export function LearnShelfClient() {
  const lang = useProfileLang();
  const { session, loading, signInWithGoogle } = useCabinetSession();
  const { shelf, failed, reload } = useLearnerShelf(session);

  const cab = useMemo(() => getCabinetCopy(lang), [lang]);
  const copy = useMemo(
    () => getProfileCopy(lang, { activePrograms: 0, completedPrograms: 0, productPurchases: 0 }),
    [lang],
  );
  const dateLocale = dateLocaleFor(lang);

  const programsHref = usePlatformHref("/programs");
  const homeHref = usePlatformHref("/");

  const gate = cabinetGate({ lang, loading, session, homeHref, onSignIn: () => void signInWithGoogle() });
  if (gate) return gate;

  return (
    <main className={surfaceStyles.profileMain} data-cw-platform-template="shelf">
      <div className={styles.shell}>
        <header className={styles.sectionHead}>
          <p className={styles.sectionLabel}>{cab.learningLabel}</p>
          <h1 className={styles.sectionTitle}>{cab.learningTitle}</h1>
        </header>

        <div className={styles.section}>
          {/* An author's shelf, above their learner's one. The cabinet used to
              be silent about the builder existing, so the only way in was to
              remember a hostname. Renders for nobody who cannot edit anything
              — see AuthorEntry. */}
          <AuthorWorkspaceCard />
          {failed ? <ShelfErrorCard copy={cab} onRetry={() => void reload()} /> : null}
          {shelf && shelf.length > 0 ? (
            <div className={styles.cardGrid}>
              {shelf.map((course) => (
                <CourseCard key={course.slug} course={course} copy={cab} dateLocale={dateLocale} />
              ))}
            </div>
          ) : failed ? null : shelf ? (
            <ShelfEmptyCard copy={cab} programsHref={programsHref} />
          ) : (
            <p className={styles.sectionLead}>{copy.loadingTitle}</p>
          )}
        </div>
      </div>
    </main>
  );
}

/**
 * The builder entry, drawn in the cabinet's own material.
 *
 * A plain <a>, not next/link: in production the builder is a different ORIGIN,
 * and the sign-in there is separate — which the card says outright rather than
 * letting the author discover it as a bounce.
 */
function AuthorWorkspaceCard() {
  const access = useAuthoringAccess();
  if (!access) return null;

  const count = access.editableCourseSlugs.length;
  if (count === 0 && !access.isAdmin) return null;

  return (
    <article className={styles.card} {...matte}>
      <h3 className={styles.cardTitle}>Ваші курси як автора</h3>
      <p className={styles.cardText}>
        {count > 0
          ? `У білдері ${count === 1 ? "один курс" : `курсів: ${count}`} — структура, уроки і публікація.`
          : "Білдер відкритий: структура, уроки і публікація курсів."}{" "}
        Білдер живе на власному домені, тому вхід там окремий від платформи.
      </p>
      <div className={styles.actions}>
        <a className={styles.actionPrimary} href={builderHref("/")}>
          Відкрити білдер
        </a>
      </div>
    </article>
  );
}
