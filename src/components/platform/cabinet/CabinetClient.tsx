"use client";

/**
 * The user cabinet.
 *
 * Replaces the flat profile page: identity hero + five sections (overview,
 * learning, tests, products, account). The overview exists to answer one
 * question — "what do I open right now" — and everything else is reference.
 *
 * Two independent reads feed it:
 *   - `/api/platform/users/me/profile` — account, dosha, purchases
 *   - `/api/lms/me/courses`           — the learning shelf, with the deep link
 *                                       into the exact lesson to continue from
 * The shelf is allowed to fail on its own: a broken LMS read must not blank the
 * profile, so its error is a card inside the learning section, not a page state.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabaseClient } from "@/lib/supabaseClient";
import surfaceStyles from "@/components/platform/PlatformSurfaceStyles";
import { resolvePlatformHref, usePlatformHref } from "@/components/platform/layout/usePlatformHref";
import { getProfileCopy } from "@/components/platform/profile/copy";
import type { ProfileLang, ProfileResponse } from "@/components/platform/profile/types";
import { DOSHA_TEST_ROUTE, TESTS_HUB_ROUTE, platformTests } from "@/lib/platform/tests";
import { fetchMyCourses, type LearnerShelfCourseDto } from "@/components/lms/lmsClient";
import { getCabinetCopy, type CabinetSection } from "./copy";
import styles from "./Cabinet.module.css";

const LANG_EVENT = "cw-lang-change";
const SECTIONS: CabinetSection[] = ["overview", "learning", "tests", "products", "account"];

function resolveProfileLang(): ProfileLang {
  if (typeof window !== "undefined") {
    try {
      if (window.localStorage.getItem("lang") === "en") return "en";
    } catch {
      // ignore storage read errors
    }
  }

  if (typeof document !== "undefined" && document.documentElement.lang.toLowerCase().startsWith("en")) {
    return "en";
  }

  return "uk";
}

/** Sections are deep-linkable (`/profile#learning`) so a lesson email can point at one. */
function resolveSectionFromHash(): CabinetSection {
  if (typeof window === "undefined") return "overview";
  const hash = window.location.hash.replace("#", "");
  return SECTIONS.includes(hash as CabinetSection) ? (hash as CabinetSection) : "overview";
}

function fmtDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

function fmtShortDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "2-digit" }).format(date);
}

function fmtMoney(amount: number | null | undefined, currency: string | null | undefined) {
  if (typeof amount !== "number") return "—";
  return `${amount} ${currency ?? ""}`.trim();
}

function getUserInitial(session: Session | null, fullName: string | null | undefined) {
  const source =
    fullName ||
    session?.user?.user_metadata?.full_name ||
    session?.user?.user_metadata?.name ||
    session?.user?.email ||
    "";
  return source.trim().charAt(0).toUpperCase() || "?";
}

function isProgramKind(kind: string) {
  return kind === "program" || kind === "mini-course";
}

function isAccessActive(expiresAt: string | null | undefined) {
  if (!expiresAt) return true;
  const expiry = new Date(expiresAt).getTime();
  return Number.isFinite(expiry) && expiry > Date.now();
}

function formatDoshaResult(resultType: string | null | undefined, lang: ProfileLang) {
  const raw = (resultType ?? "").trim().toLowerCase();
  if (!raw) return lang === "en" ? "Not defined yet" : "Ще не визначено";

  const dictionary =
    lang === "en"
      ? { vata: "Vata", pitta: "Pitta", kapha: "Kapha", tridosha: "Tridosha", tridoshic: "Tridoshic" }
      : { vata: "Вата", pitta: "Пітта", kapha: "Капха", tridosha: "Тридоша", tridoshic: "Тридоша" };

  return raw.replace(
    /\b(vata|pitta|kapha|tridosha|tridoshic)\b/g,
    (token) => dictionary[token as keyof typeof dictionary] ?? token,
  );
}

function formatAccessStatus(used: boolean, expiresAt: string | null | undefined, lang: ProfileLang) {
  if (used) return lang === "en" ? "Access used" : "Доступ використано";
  if (!expiresAt) return lang === "en" ? "Access created" : "Доступ створено";

  const expiry = new Date(expiresAt).getTime();
  if (Number.isFinite(expiry) && Date.now() > expiry) {
    return lang === "en" ? "Access expired" : "Термін доступу минув";
  }

  return lang === "en" ? "Access active" : "Доступ активний";
}

/** Where a shelf entry sends the learner, and what the button says. */
function courseAction(course: LearnerShelfCourseDto, copy: ReturnType<typeof getCabinetCopy>) {
  const map = `/learn/${course.slug}`;

  if (course.access === "locked") {
    return { href: `/programs/${course.programSlug}`, label: copy.openProgramPage, primary: false };
  }
  if (course.access === "available") {
    return { href: map, label: copy.startAction, primary: true };
  }
  if (course.standing?.isFinished || !course.currentLessonSlug) {
    return { href: map, label: copy.openCourseMap, primary: false };
  }

  return { href: `/learn/${course.slug}/${course.currentLessonSlug}`, label: copy.continueAction, primary: true };
}

export function CabinetClient() {
  const isAuthEnabled = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isAuthEnabled);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<ProfileLang>("uk");
  const [section, setSection] = useState<CabinetSection>("overview");
  const [shelf, setShelf] = useState<LearnerShelfCourseDto[] | null>(null);
  const [shelfFailed, setShelfFailed] = useState(false);

  const doshaTestHref = usePlatformHref(DOSHA_TEST_ROUTE);
  const testsHubHref = usePlatformHref(TESTS_HUB_ROUTE);
  const programsHref = usePlatformHref("/programs");
  const homeHref = usePlatformHref("/");

  useEffect(() => {
    const syncLang = () => setLang(resolveProfileLang());
    const syncSection = () => setSection(resolveSectionFromHash());
    syncLang();
    syncSection();
    window.addEventListener("storage", syncLang);
    window.addEventListener(LANG_EVENT, syncLang);
    // A `/profile#tests` link followed from inside the app changes the hash
    // without remounting, so the initial read alone would ignore it.
    window.addEventListener("hashchange", syncSection);
    return () => {
      window.removeEventListener("storage", syncLang);
      window.removeEventListener(LANG_EVENT, syncLang);
      window.removeEventListener("hashchange", syncSection);
    };
  }, []);

  const purchases = useMemo(() => profile?.profile.purchases ?? [], [profile]);

  const activePrograms = useMemo(
    () =>
      purchases.filter(
        (purchase) =>
          isProgramKind(purchase.offerKind) &&
          purchase.access &&
          !purchase.access.used &&
          isAccessActive(purchase.access.expires_at),
      ),
    [purchases],
  );

  const completedPrograms = useMemo(
    () =>
      purchases.filter(
        (purchase) =>
          isProgramKind(purchase.offerKind) &&
          (purchase.access?.used || !purchase.access || !isAccessActive(purchase.access.expires_at)),
      ),
    [purchases],
  );

  const productPurchases = useMemo(
    () => purchases.filter((purchase) => purchase.offerKind === "product"),
    [purchases],
  );

  const copy = useMemo(
    () =>
      getProfileCopy(lang, {
        activePrograms: activePrograms.length,
        completedPrograms: completedPrograms.length,
        productPurchases: productPurchases.length,
      }),
    [lang, activePrograms.length, completedPrograms.length, productPurchases.length],
  );

  const cab = useMemo(() => getCabinetCopy(lang), [lang]);
  const dateLocale = lang === "en" ? "en-US" : "uk-UA";

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = typeof window !== "undefined" ? window.location.href : undefined;
    await supabaseClient.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  }, []);

  const signOut = useCallback(async () => {
    await supabaseClient.auth.signOut();
    setProfile(null);
    setSession(null);
    setShelf(null);
  }, []);

  const loadShelf = useCallback(async () => {
    setShelfFailed(false);
    const result = await fetchMyCourses();
    if (result.ok) {
      setShelf(result.data.courses);
    } else {
      setShelfFailed(true);
    }
  }, []);

  useEffect(() => {
    if (!isAuthEnabled) return;

    const boot = async () => {
      const { data } = await supabaseClient.auth.getSession();
      setSession(data.session);

      if (!data.session?.access_token) {
        setLoading(false);
        return;
      }

      const read = (token: string) =>
        fetch("/api/platform/users/me/profile", { headers: { Authorization: `Bearer ${token}` } });

      let res = await read(data.session.access_token);

      // A token that expired between restore and first read returns 401 once.
      // Refreshing and retrying beats showing "could not assemble the profile"
      // to a signed-in user whose session is perfectly valid.
      if (res.status === 401) {
        const { data: refreshed } = await supabaseClient.auth.refreshSession();
        if (refreshed.session?.access_token) res = await read(refreshed.session.access_token);
      }

      if (!res.ok) {
        setError("Не вдалося завантажити профіль.");
        setLoading(false);
        return;
      }

      setProfile((await res.json()) as ProfileResponse);
      // Clears a failure left by an earlier attempt — React runs this effect
      // twice in dev, and the first pass can lose a token-refresh race.
      setError(null);
      setLoading(false);
      void loadShelf();
    };

    void boot();

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));

    return () => subscription.unsubscribe();
  }, [isAuthEnabled, loadShelf]);

  const selectSection = useCallback((next: CabinetSection) => {
    setSection(next);
    // replaceState, not push: section switching is not navigation history.
    window.history.replaceState(null, "", next === "overview" ? window.location.pathname : `#${next}`);
  }, []);

  const scoreBars = useMemo(() => {
    const scores = profile?.profile.dosha?.scores;
    if (!scores) return [];
    const max = Math.max(scores.vata ?? 0, scores.pitta ?? 0, scores.kapha ?? 0, 1);
    return (["vata", "pitta", "kapha"] as const).map((key) => ({
      key,
      label: copy.doshaLabels[key],
      value: scores[key] ?? 0,
      width: `${Math.max(12, Math.round(((scores[key] ?? 0) / max) * 100))}%`,
    }));
  }, [copy.doshaLabels, profile]);

  const ownedCourses = useMemo(
    () => (shelf ?? []).filter((course) => course.access !== "locked"),
    [shelf],
  );

  /** The single course the overview offers to resume: in-flight first, then unstarted. */
  const resumeCourse = useMemo(() => {
    const started = ownedCourses.find(
      (course) => course.access === "enrolled" && !course.standing?.isFinished && course.currentLessonSlug,
    );
    return started ?? ownedCourses.find((course) => course.access === "available") ?? ownedCourses[0] ?? null;
  }, [ownedCourses]);

  if (!isAuthEnabled) {
    return (
      <section className={`${surfaceStyles.container} ${surfaceStyles.section}`}>
        <article className={surfaceStyles.panel}>
          <p className={surfaceStyles.label}>{copy.profile}</p>
          <h1 className={surfaceStyles.title}>{copy.unavailableTitle}</h1>
          <p className={surfaceStyles.lead}>{copy.unavailableLead}</p>
        </article>
      </section>
    );
  }

  if (loading) {
    return (
      <section className={`${surfaceStyles.container} ${surfaceStyles.section}`}>
        <article className={surfaceStyles.panel}>
          <p className={surfaceStyles.label}>{copy.profile}</p>
          <h1 className={surfaceStyles.title}>{copy.loadingTitle}</h1>
          <p className={surfaceStyles.lead}>{copy.loadingLead}</p>
        </article>
      </section>
    );
  }

  if (!session?.user) {
    return (
      <main className={surfaceStyles.profileEmptyMain} data-cw-platform-template="profile-empty">
        <section className={`${surfaceStyles.container} ${surfaceStyles.section} ${surfaceStyles.profileEmptySection}`}>
          <article className={`${surfaceStyles.panel} ${surfaceStyles.profileEmptyPanel}`}>
            <p className={surfaceStyles.label}>{copy.profile}</p>
            <h1 className={surfaceStyles.title}>{copy.authTitle}</h1>
            <p className={surfaceStyles.lead}>{copy.authLead}</p>
            <div className={`${surfaceStyles.heroFooter} ${surfaceStyles.profileEmptyActions}`}>
              <button className={surfaceStyles.primaryButton} type="button" onClick={() => void signInWithGoogle()}>
                {copy.signIn}
              </button>
              <Link className={surfaceStyles.secondaryButton} href={homeHref}>
                {copy.returnHome}
              </Link>
            </div>
          </article>
        </section>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <section className={`${surfaceStyles.container} ${surfaceStyles.section}`}>
        <article className={surfaceStyles.panel}>
          <p className={surfaceStyles.label}>{copy.profile}</p>
          <h1 className={surfaceStyles.title}>{copy.errorTitle}</h1>
          <p className={surfaceStyles.lead}>{error ?? copy.errorFallback}</p>
        </article>
      </section>
    );
  }

  const { account, contacts, dosha } = profile.profile;

  const renderCourseCard = (course: LearnerShelfCourseDto) => {
    const action = courseAction(course, cab);
    const done = course.standing?.completedLessons ?? 0;
    const total = course.standing?.totalLessons ?? 0;
    const ratio = total > 0 ? done / total : 0;

    const stateChip =
      course.access === "locked"
        ? course.lockReason === "expired"
          ? cab.courseExpired
          : cab.courseLocked
        : course.access === "available"
          ? cab.courseNotStarted
          : course.standing?.isFinished
            ? cab.courseFinished
            : null;

    return (
      <article key={course.slug} className={course.access === "locked" ? styles.cardMuted : styles.card}>
        <div className={styles.chipRow}>
          {stateChip ? (
            <span className={course.standing?.isFinished ? styles.chipDone : styles.chip}>{stateChip}</span>
          ) : null}
          {course.access === "enrolled" && total > 0 ? (
            <span className={styles.chip}>{cab.stepsOf(done, total)}</span>
          ) : null}
          {course.standing?.currentDay ? (
            <span className={styles.chip}>{cab.dayNumber(course.standing.currentDay)}</span>
          ) : null}
          {course.status === "draft" ? <span className={styles.chip}>{cab.courseDraft}</span> : null}
        </div>

        <h3 className={styles.cardTitle}>{course.title}</h3>
        {course.summary ? <p className={styles.cardText}>{course.summary}</p> : null}

        {course.access === "enrolled" && total > 0 ? (
          <div
            className={styles.meter}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
            aria-label={course.title}
          >
            <div className={styles.meterFill} style={{ width: `${Math.round(ratio * 100)}%` }} />
          </div>
        ) : null}

        <ul className={styles.metaList}>
          {course.currentLessonTitle && !course.standing?.isFinished ? (
            <li>
              {cab.nextStepLabel}: <strong>{course.currentLessonTitle}</strong>
            </li>
          ) : null}
          {course.startedAt ? (
            <li>
              {cab.startedAtLabel}: <strong>{fmtShortDate(course.startedAt, dateLocale)}</strong>
            </li>
          ) : null}
        </ul>

        <div className={styles.actions}>
          <Link
            className={action.primary ? styles.actionPrimary : styles.actionGhost}
            href={resolvePlatformHref(action.href)}
          >
            {action.label}
          </Link>
          {course.access !== "locked" && action.href !== `/learn/${course.slug}` ? (
            <Link className={styles.actionGhost} href={resolvePlatformHref(`/learn/${course.slug}`)}>
              {cab.openCourseMap}
            </Link>
          ) : null}
        </div>
      </article>
    );
  };

  const shelfNotice = shelfFailed ? (
    <article className={styles.card}>
      <h3 className={styles.cardTitle}>{cab.shelfErrorTitle}</h3>
      <p className={styles.cardText}>{cab.shelfErrorLead}</p>
      <div className={styles.actions}>
        <button className={styles.actionGhost} type="button" onClick={() => void loadShelf()}>
          {cab.retry}
        </button>
      </div>
    </article>
  ) : null;

  const learningEmpty = (
    <article className={styles.card}>
      <h3 className={styles.cardTitle}>{cab.learningEmptyTitle}</h3>
      <p className={styles.cardText}>{cab.learningEmptyLead}</p>
      <div className={styles.actions}>
        <Link className={styles.actionPrimary} href={programsHref}>
          {cab.browsePrograms}
        </Link>
      </div>
    </article>
  );

  return (
    <main className={surfaceStyles.profileMain} data-cw-platform-template="cabinet">
      <section
        className={`${surfaceStyles.heroFeature} ${styles.hero}`}
        data-cw-profile-hero="true"
        data-cw-topbar-tone="dark"
        data-cw-semantic-role="progress"
        data-cw-semantic-family="guide-trust"
        data-cw-token-source="global-app-ds"
      >
        <div className={surfaceStyles.heroPhotoLayer} aria-hidden="true" />
        <div className={`${surfaceStyles.heroFeatureContent} ${styles.heroContent}`}>
          <p className={surfaceStyles.heroBadge}>
            <span>{copy.badge}</span>
          </p>
          <article className={surfaceStyles.profileHeroIdentityCard}>
            <div className={surfaceStyles.profileHeroIdentity}>
              <span className={surfaceStyles.profileHeroAvatar} aria-hidden="true">
                {account.avatarUrl ? (
                  // Remote auth avatars stay on plain img to avoid introducing image config coupling into platform profile.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={account.avatarUrl} alt="" referrerPolicy="no-referrer" />
                ) : (
                  getUserInitial(session, account.fullName)
                )}
              </span>
              <div className={surfaceStyles.panelIntro}>
                <p className={surfaceStyles.profileHeroKicker}>{copy.profile}</p>
                <h1 className={`${surfaceStyles.detailHeroTitle} ${styles.heroName}`}>
                  {account.fullName ?? "Ваш профіль CenterWay"}
                </h1>
                <p className={surfaceStyles.heroFeatureLead}>
                  {account.email ?? "Google-профіль підключено до CenterWay"}
                </p>
              </div>
            </div>
          </article>
          <div className={surfaceStyles.profileStatGrid}>
            <article className={surfaceStyles.profileStatCard} data-tone="guide">
              <p className={surfaceStyles.label}>{copy.dosha}</p>
              <strong>{formatDoshaResult(dosha?.resultType, lang)}</strong>
            </article>
            <article className={surfaceStyles.profileStatCard} data-tone="support">
              <p className={surfaceStyles.label}>{cab.learningLabel}</p>
              <strong>{ownedCourses.length > 0 ? cab.coursesCount(ownedCourses.length) : copy.noPrograms}</strong>
            </article>
            <article className={surfaceStyles.profileStatCard} data-tone="proof">
              <p className={surfaceStyles.label}>{copy.products}</p>
              <strong>
                {productPurchases.length > 0 ? cab.productsCount(productPurchases.length) : copy.noProducts}
              </strong>
            </article>
          </div>
        </div>
      </section>

      <div className={styles.shell}>
        <nav className={styles.tabs} aria-label={cab.navAria}>
          {SECTIONS.map((key) => (
            <button
              key={key}
              type="button"
              className={key === section ? styles.tabActive : styles.tab}
              aria-current={key === section ? "page" : undefined}
              onClick={() => selectSection(key)}
            >
              {cab.nav[key]}
            </button>
          ))}
        </nav>

        {section === "overview" ? (
          <div className={styles.section}>
            {resumeCourse ? (
              <article className={styles.continueCard}>
                <p className={styles.sectionLabel}>{cab.continueTitle}</p>
                <h2 className={styles.cardTitle}>{resumeCourse.title}</h2>
                {resumeCourse.currentLessonTitle && !resumeCourse.standing?.isFinished ? (
                  <p className={styles.continueNext}>{resumeCourse.currentLessonTitle}</p>
                ) : (
                  <p className={styles.cardText}>{cab.continueLead}</p>
                )}
                {resumeCourse.standing && resumeCourse.standing.totalLessons > 0 ? (
                  <>
                    <div
                      className={styles.meter}
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={resumeCourse.standing.totalLessons}
                      aria-valuenow={resumeCourse.standing.completedLessons}
                      aria-label={resumeCourse.title}
                    >
                      <div
                        className={styles.meterFill}
                        style={{
                          width: `${Math.round(
                            (resumeCourse.standing.completedLessons / resumeCourse.standing.totalLessons) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                    <p className={styles.cardText}>
                      {cab.stepsOf(resumeCourse.standing.completedLessons, resumeCourse.standing.totalLessons)}
                    </p>
                  </>
                ) : null}
                <div className={styles.actions}>
                  <Link
                    className={styles.actionPrimary}
                    href={resolvePlatformHref(courseAction(resumeCourse, cab).href)}
                  >
                    {courseAction(resumeCourse, cab).label}
                  </Link>
                  <Link className={styles.actionGhost} href={resolvePlatformHref(`/learn/${resumeCourse.slug}`)}>
                    {cab.openCourseMap}
                  </Link>
                </div>
              </article>
            ) : (
              shelfNotice ?? learningEmpty
            )}

            <div className={styles.cardGrid}>
              <article className={styles.card}>
                <p className={styles.sectionLabel}>{copy.dosha}</p>
                <h2 className={styles.cardTitle}>{copy.doshaCurrent}</h2>
                {dosha ? (
                  <>
                    <p className={styles.cardText}>
                      {formatDoshaResult(dosha.resultType, lang)} · {copy.completedShort}{" "}
                      {fmtShortDate(dosha.completedAt, dateLocale)}
                    </p>
                    <div className={styles.scoreList}>
                      {scoreBars.map((item) => (
                        <div key={item.key} className={styles.scoreRow}>
                          <div className={styles.scoreMeta}>
                            <span>{item.label}</span>
                            <strong>{item.value}</strong>
                          </div>
                          <div className={styles.meter}>
                            <span className={styles.meterFill} style={{ width: item.width }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className={styles.cardText}>{copy.doshaEmptyLead}</p>
                )}
                <div className={styles.actions}>
                  <Link className={dosha ? styles.actionGhost : styles.actionPrimary} href={doshaTestHref}>
                    {dosha ? copy.retakeTest : copy.startTest}
                  </Link>
                </div>
              </article>

              <article className={styles.card}>
                <p className={styles.sectionLabel}>{copy.routeSummaryLabel}</p>
                <h2 className={styles.cardTitle}>{copy.routeSummaryTitle}</h2>
                <ul className={styles.metaList}>
                  <li>
                    {copy.summaryActivePrograms}: <strong>{copy.summaryActiveProgramsValue}</strong>
                  </li>
                  <li>
                    {copy.summaryCompletedPrograms}: <strong>{copy.summaryCompletedProgramsValue}</strong>
                  </li>
                  <li>
                    {copy.summaryProducts}: <strong>{copy.summaryProductsValue}</strong>
                  </li>
                </ul>
                <div className={styles.actions}>
                  <Link className={styles.actionGhost} href={programsHref}>
                    {cab.browsePrograms}
                  </Link>
                </div>
              </article>
            </div>
          </div>
        ) : null}

        {section === "learning" ? (
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <p className={styles.sectionLabel}>{cab.learningLabel}</p>
              <h2 className={styles.sectionTitle}>{cab.learningTitle}</h2>
            </div>
            {shelfNotice}
            {shelf && shelf.length > 0 ? (
              <div className={styles.cardGrid}>{shelf.map(renderCourseCard)}</div>
            ) : shelfFailed ? null : shelf ? (
              learningEmpty
            ) : (
              <p className={styles.sectionLead}>{copy.loadingTitle}</p>
            )}
          </div>
        ) : null}

        {section === "tests" ? (
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <p className={styles.sectionLabel}>{cab.testsLabel}</p>
              <h2 className={styles.sectionTitle}>{cab.testsTitle}</h2>
              <p className={styles.sectionLead}>{cab.testsLead}</p>
            </div>
            <div className={styles.cardGrid}>
              {platformTests.map((test) => {
                const isDosha = test.slug === "dosha";
                const passed = isDosha && Boolean(dosha);

                return (
                  <article key={test.slug} className={test.status === "planned" ? styles.cardMuted : styles.card}>
                    <div className={styles.chipRow}>
                      <span className={styles.chip}>{test.tag}</span>
                      {test.status === "planned" ? <span className={styles.chip}>{cab.testPlanned}</span> : null}
                      {passed ? <span className={styles.chipDone}>{cab.testPassed}</span> : null}
                    </div>
                    <h3 className={styles.cardTitle}>{test.title}</h3>
                    <p className={styles.cardText}>{test.description}</p>
                    {passed && dosha ? (
                      <>
                        <ul className={styles.metaList}>
                          <li>
                            {copy.doshaResultPrefix}: <strong>{formatDoshaResult(dosha.resultType, lang)}</strong>
                          </li>
                          <li>
                            {copy.completedShort}: <strong>{fmtDate(dosha.completedAt, dateLocale)}</strong>
                          </li>
                        </ul>
                        <div className={styles.scoreList}>
                          {scoreBars.map((item) => (
                            <div key={item.key} className={styles.scoreRow}>
                              <div className={styles.scoreMeta}>
                                <span>{item.label}</span>
                                <strong>{item.value}</strong>
                              </div>
                              <div className={styles.meter}>
                                <span className={styles.meterFill} style={{ width: item.width }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className={styles.cardText}>{test.format}</p>
                    )}
                    {test.href ? (
                      <div className={styles.actions}>
                        <Link
                          className={passed ? styles.actionGhost : styles.actionPrimary}
                          href={resolvePlatformHref(test.href)}
                        >
                          {passed ? copy.retakeTest : cab.testOpen}
                        </Link>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
            <div className={styles.actions}>
              <Link className={styles.actionGhost} href={testsHubHref}>
                {cab.testsLabel}
              </Link>
            </div>
          </div>
        ) : null}

        {section === "products" ? (
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <p className={styles.sectionLabel}>{copy.products}</p>
              <h2 className={styles.sectionTitle}>{copy.productsTitle}</h2>
            </div>
            {purchases.length > 0 ? (
              <div className={styles.cardGrid}>
                {purchases.map((purchase) => (
                  <article key={purchase.orderRef} className={styles.card}>
                    <div className={styles.chipRow}>
                      <span className={styles.chip}>
                        {isProgramKind(purchase.offerKind) ? copy.programsLabel : copy.productLabel}
                      </span>
                    </div>
                    <h3 className={styles.cardTitle}>{purchase.title}</h3>
                    <ul className={styles.metaList}>
                      <li>
                        {copy.purchasedAt}: <strong>{fmtDate(purchase.createdAt, dateLocale)}</strong>
                      </li>
                      <li>
                        {copy.price}: <strong>{fmtMoney(purchase.amount, purchase.currency)}</strong>
                      </li>
                      <li>
                        {copy.accessStatus}:{" "}
                        <strong>
                          {purchase.access
                            ? formatAccessStatus(purchase.access.used, purchase.access.expires_at, lang)
                            : copy.productNoAccess}
                        </strong>
                      </li>
                    </ul>
                  </article>
                ))}
              </div>
            ) : (
              <article className={styles.card}>
                <p className={styles.cardText}>{copy.noProductsLead}</p>
                <div className={styles.actions}>
                  <Link className={styles.actionPrimary} href={programsHref}>
                    {cab.browsePrograms}
                  </Link>
                </div>
              </article>
            )}
          </div>
        ) : null}

        {section === "account" ? (
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <p className={styles.sectionLabel}>{cab.accountLabel}</p>
              <h2 className={styles.sectionTitle}>{cab.accountTitle}</h2>
              <p className={styles.sectionLead}>{cab.accountLead}</p>
            </div>
            <article className={styles.card}>
              <h3 className={styles.cardTitle}>{copy.contactsTitle}</h3>
              <ul className={styles.metaList}>
                <li>
                  {copy.name}: <strong>{account.fullName ?? copy.emptyValue}</strong>
                </li>
                <li>
                  {copy.email}: <strong>{account.email ?? copy.emptyValue}</strong>
                </li>
                <li>
                  {copy.phone}: <strong>{contacts?.phone ?? copy.emptyValue}</strong>
                </li>
                <li>
                  {copy.telegram}: <strong>{contacts?.telegram ?? copy.emptyValue}</strong>
                </li>
              </ul>
              <div className={styles.actions}>
                <button className={styles.actionGhost} type="button" onClick={() => void signOut()}>
                  {copy.signOut}
                </button>
              </div>
            </article>
          </div>
        ) : null}
      </div>
    </main>
  );
}
