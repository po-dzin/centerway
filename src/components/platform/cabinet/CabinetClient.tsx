"use client";

/**
 * The profile, at `/profile` — a dashboard, not a container of tabs.
 *
 * It used to carry five sections behind hashes, and two of them repeated the
 * showcase word for word: the header said "Діагностика" and "Продукти" meaning
 * the catalogue, the cabinet said them meaning what you own. Same words, two
 * meanings, one screen apart. The shelf moved out to `/learn`, and what is left
 * here answers one question in one scroll — who am I, where did I stop, what
 * did I buy, can support reach me — with the learning itself one link away.
 *
 * Two independent reads feed it:
 *   - `/api/platform/users/me/profile` — account, dosha, purchases
 *   - `/api/lms/me/courses`           — the shelf, for the resume card only
 * The shelf is allowed to fail on its own: a broken LMS read must not blank the
 * profile, so its failure costs the resume card and nothing else.
 */

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

import surfaceStyles from "@/components/platform/PlatformSurfaceStyles";
import { ProgressRail } from "@/components/platform/ProgressRail";
import { ProgressRing } from "@/components/platform/ProgressRing";
import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import { getProfileCopy } from "@/components/platform/profile/copy";
import { DOSHA_TEST_ROUTE } from "@/lib/platform/tests";
import { LEARNING_SHELF_HREF } from "@/lib/platform/content";
import { PwaInstallRow } from "./PwaInstallCard";
import { cabinetGate } from "./CabinetGate";
import { CabinetFold } from "./CabinetFold";
import { ShelfErrorCard, courseAction, courseMapHref, matte } from "./CourseCard";
import { CourseCover } from "./CourseCover";
import {
  dateLocaleFor,
  fmtDate,
  fmtMoney,
  formatAccessStatus,
  formatDoshaResult,
  formatTelegram,
  getUserInitial,
  isAccessActive,
  isProgramKind,
} from "./format";
import { getCabinetCopy } from "./copy";
import { pickResumeCourse } from "./resumeCourse";
import {
  useCabinetSession,
  useLearnerShelf,
  useProfileData,
  useProfileLang,
  useTelegramReach,
} from "./useCabinet";
import styles from "./Cabinet.module.css";

/**
 * The hashes the cabinet used to answer on.
 *
 * `#learning` is in mail already sent, in the support bot's saved replies and
 * in whatever anybody bookmarked — and a fragment never reaches the server, so
 * no rule in the proxy can ever catch it. It has to be caught here, on mount,
 * and turned into the route it became. The other three collapsed into this one
 * page, so they are cleaned off the URL rather than redirected.
 */
const MIGRATED_HASHES = new Set(["#tests", "#products", "#account", "#overview"]);

function useHashMigration() {
  const router = useRouter();

  useEffect(() => {
    const migrate = () => {
      const hash = window.location.hash;
      if (hash === "#learning") {
        router.replace(LEARNING_SHELF_HREF);
        return;
      }
      if (MIGRATED_HASHES.has(hash)) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    };

    migrate();
    window.addEventListener("hashchange", migrate);
    return () => window.removeEventListener("hashchange", migrate);
  }, [router]);
}

export function CabinetClient() {
  useHashMigration();

  const lang = useProfileLang();
  const { session, loading: sessionLoading, signInWithGoogle, signOut } = useCabinetSession();
  const { profile, loading: profileLoading, error, clear: clearProfile } = useProfileData(session);
  const { shelf, failed: shelfFailed, reload: reloadShelf } = useLearnerShelf(session);
  const reach = useTelegramReach(session);

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
  const dateLocale = dateLocaleFor(lang);

  const href = useSurfaceHref();
  const doshaTestHref = href(DOSHA_TEST_ROUTE);
  const programsHref = href("/programs");
  const shelfHref = href(LEARNING_SHELF_HREF);
  const homeHref = href("/");

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

  /**
   * The compact overview: every owned course as one ring of dots.
   *
   * Only courses whose length is known can be drawn — a ring with no lessons to
   * count is a circle, not progress — and only from two upwards, because with
   * one course the resume card above already IS the overview and this would
   * repeat it in a smaller hand.
   */
  const overviewCourses = useMemo(
    () => ownedCourses.filter((course) => (course.standing?.totalLessons ?? 0) > 0),
    [ownedCourses],
  );

  /** The single course the dashboard offers to resume: latest real activity wins. */
  const resumeCourse = useMemo(() => pickResumeCourse(ownedCourses), [ownedCourses]);

  /**
   * The shelf has THREE states, and `null` is not one of the two obvious ones.
   *
   * `useLearnerShelf` returns null both while the read is in flight and when it
   * was read for a different account, and this page used to collapse that into
   * the empty state — so a learner who owns nine courses was told, for as long
   * as the read took, that they own none, under a button offering to sell them
   * some. The gate above waits for the session and the profile, not for this:
   * the shelf is deliberately allowed to fail on its own, and the price of that
   * independence is that its waiting has to be rendered here.
   *
   * `/learn` has drawn this distinction since it split off (`LearnShelfClient`);
   * this is the same rule on the page that kept the resume card.
   */
  const shelfLoading = !shelfFailed && shelf === null;

  const gate = cabinetGate({
    lang,
    loading: sessionLoading || profileLoading,
    session,
    error,
    homeHref,
    onSignIn: () => void signInWithGoogle(),
  });
  if (gate) return gate;
  if (!profile) return null;

  const { account, contacts, dosha } = profile.profile;

  return (
    <main className={surfaceStyles.profileMain} data-cw-platform-template="cabinet">
      <div className={styles.shell}>
        {/* The profile's header is the first panel of the page, in the page's
            own material. It used to be a landing-style photo hero carrying a
            translucent identity card and three bordered stat tiles — a second
            surface vocabulary two inches above the first. */}
        <header className={styles.identity} {...matte}>
          <div className={styles.identityMain}>
            <span className={styles.avatar} aria-hidden="true">
              {account.avatarUrl ? (
                // Remote auth avatars stay on plain img to avoid introducing image config coupling into platform profile.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={account.avatarUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                getUserInitial(session, account.fullName)
              )}
            </span>
            <div className={styles.identityText}>
              <p className={styles.sectionLabel}>{copy.profile}</p>
              <h1 className={styles.identityName}>{account.fullName ?? copy.fallbackName}</h1>
              <p className={styles.identityEmail}>{account.email ?? copy.fallbackEmail}</p>
            </div>
          </div>

          <dl className={styles.identityStats}>
            <div className={styles.identityStat}>
              <dt className={styles.sectionLabel}>{copy.dosha}</dt>
              <dd>{formatDoshaResult(dosha?.resultType, lang)}</dd>
            </div>
            <div className={styles.identityStat}>
              <dt className={styles.sectionLabel}>{cab.learningLabel}</dt>
              {/* "—" is an answer: it means none. While the shelf is still
                  being read there is no answer yet, and an ellipsis says that
                  without claiming the library is empty. */}
              <dd>
                {shelfLoading
                  ? "…"
                  : ownedCourses.length > 0
                    ? cab.coursesCount(ownedCourses.length)
                    : copy.emptyValue}
              </dd>
            </div>
            <div className={styles.identityStat}>
              <dt className={styles.sectionLabel}>{copy.products}</dt>
              <dd>{productPurchases.length > 0 ? cab.productsCount(productPurchases.length) : copy.emptyValue}</dd>
            </div>
          </dl>
        </header>

        {/* Where you stopped, first and alone. The dashboard's whole job is to
            answer "what do I open right now", and everything below it is
            reference that answer does not need. */}
        <div className={styles.section}>
          {resumeCourse ? (
            <article className={styles.continueCard} {...matte}>
              {/* Only here, and only for the one course being resumed: the
                  dashboard answers "what do I open right now", and a cover per
                  owned course would turn that answer into a gallery. */}
              <CourseCover course={resumeCourse} />
              <p className={styles.sectionLabel}>{cab.continueTitle}</p>
              <h2 className={styles.cardTitle}>{resumeCourse.title}</h2>
              {resumeCourse.currentLessonTitle && !resumeCourse.standing?.isFinished ? (
                <p className={styles.continueNext}>{resumeCourse.currentLessonTitle}</p>
              ) : (
                <p className={styles.cardText}>{cab.continueLead}</p>
              )}
              {resumeCourse.standing && resumeCourse.standing.totalLessons > 0 ? (
                <>
                  <ProgressRail
                    value={resumeCourse.standing.completedLessons}
                    total={resumeCourse.standing.totalLessons}
                    label={resumeCourse.title}
                  />
                  <p className={styles.cardText}>
                    {cab.stepsOf(resumeCourse.standing.completedLessons, resumeCourse.standing.totalLessons)}
                  </p>
                </>
              ) : null}
              <div className={styles.actions}>
                <Link
                  className={styles.actionPrimary}
                  href={href(courseAction(resumeCourse, cab).href)}
                >
                  {courseAction(resumeCourse, cab).label}
                </Link>
                {/* The shelf, not this one course's map: from the dashboard the
                    useful second step is "everything I own". */}
                <Link className={styles.actionGhost} href={shelfHref}>
                  {cab.allCourses}
                </Link>
              </div>
            </article>
          ) : shelfFailed ? (
            /* Not "no courses yet" — the shelf just could not be read. Those
               look identical without this branch, and a learner who paid for
               something would be told to go buy it again. */
            <ShelfErrorCard copy={cab} onRetry={() => void reloadShelf()} />
          ) : shelfLoading ? (
            /* Same reasoning as the branch above, one state earlier: still
               reading is not the same as nothing to read. */
            <PlatformLoadingState
              label={cab.learningLabel}
              title={cab.learningLoadingTitle}
              detail={cab.learningLoadingLead}
            />
          ) : (
            <article className={styles.card} {...matte}>
              <h3 className={styles.cardTitle}>{cab.learningEmptyTitle}</h3>
              <p className={styles.cardText}>{cab.learningEmptyLead}</p>
              <div className={styles.actions}>
                <Link className={styles.actionPrimary} href={programsHref}>
                  {cab.browsePrograms}
                </Link>
              </div>
            </article>
          )}

          {/* Everything else I own, at a glance. The resume card answers "what
              now"; this answers "and how do the rest stand" — and it is also
              the way INTO them from here, which the dashboard otherwise leaves
              entirely to the header's app switcher. One glyph per course, so
              five courses cost one row rather than five cards. */}
          {overviewCourses.length > 1 ? (
            <section className={styles.overview} {...matte} aria-labelledby="cw-profile-overview">
              <p className={styles.sectionLabel} id="cw-profile-overview">
                {cab.learningLabel}
              </p>
              <ul className={styles.ringList}>
                {overviewCourses.map((course) => (
                  <li key={course.slug}>
                    <Link className={styles.ringItem} href={href(courseMapHref(course))}>
                      <ProgressRing
                        value={course.standing?.completedLessons ?? 0}
                        total={course.standing?.totalLessons ?? 0}
                        label={course.title}
                      />
                      <span className={styles.ringTitle}>{course.title}</span>
                      <span className={styles.ringMeta}>
                        {cab.stepsOf(
                          course.standing?.completedLessons ?? 0,
                          course.standing?.totalLessons ?? 0,
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className={styles.actions}>
                <Link className={styles.actionGhost} href={shelfHref}>
                  {cab.allCourses}
                </Link>
              </div>
            </section>
          ) : null}

          <div className={styles.cardGrid}>
            {/* The dosha RESULT, not the tests catalogue. What the test is and
                what else exists is the showcase's business — this card holds
                the answer that belongs to this person. */}
            <article className={styles.card} {...matte}>
              <p className={styles.sectionLabel}>{copy.dosha}</p>
              <h2 className={styles.cardTitle}>{copy.doshaCurrent}</h2>
              {dosha ? (
                <>
                  <p className={styles.cardText}>
                    {formatDoshaResult(dosha.resultType, lang)} · {copy.completedShort}{" "}
                    {fmtDate(dosha.completedAt, dateLocale)}
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
          </div>
        </div>

        {/* Folded shut on a phone. A receipt is reference, not the answer the
            dashboard exists to give, and one column of them was a ribbon
            between the reader and the end of their own account. */}
        <CabinetFold label={copy.products} title={copy.productsTitle}>
          {purchases.length > 0 ? (
            <div className={styles.cardGrid}>
              {purchases.map((purchase) => (
                  <article key={purchase.orderRef} className={styles.card} {...matte}>
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
                    {/* No link into the course from here on purpose: a
                        purchase carries an OFFER code, and the shelf carries a
                        program slug. They are not the same key, and a lookup
                        that happens to match today would silently send someone
                        to the wrong course the first time they diverge. The way
                        into a course is the shelf, which is keyed correctly. */}
                  </article>
              ))}
            </div>
          ) : (
            <article className={styles.card} {...matte}>
              <p className={styles.cardText}>{copy.noProductsLead}</p>
              <div className={styles.actions}>
                <Link className={styles.actionPrimary} href={programsHref}>
                  {cab.browsePrograms}
                </Link>
              </div>
            </article>
          )}
        </CabinetFold>

        <CabinetFold label={cab.accountLabel} title={cab.accountTitle} lead={cab.accountLead}>
          <div className={styles.cardGrid}>
            <article className={styles.card} {...matte}>
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
                  {copy.telegram}: <strong>{formatTelegram(contacts, copy.emptyValue)}</strong>
                </li>
              </ul>
              <div className={styles.actions}>
                <button
                  className={styles.actionGhost}
                  type="button"
                  onClick={() => {
                    clearProfile();
                    void signOut();
                  }}
                >
                  {copy.signOut}
                </button>
              </div>
            </article>

            {/* Reachability belongs to the account, beside the contacts it is
                one of: "can support reach me" and "what is my phone number" are
                the same question asked twice. It sat up in the dosha row for a
                while, where a boundary-toned panel beside a test result read as
                an alert about the test. */}
            {reach ? (
              <article className={reach.linked ? styles.card : styles.notice} {...matte}>
                <h3 className={styles.cardTitle}>{cab.notificationsTitle}</h3>
                <p className={styles.cardText}>
                  {reach.linked
                    ? cab.notificationsLinked
                    : reach.linkUrl
                      ? cab.notificationsMissing
                      : cab.notificationsUnavailable}
                </p>
                {!reach.linked && reach.linkUrl ? (
                  <div className={styles.actions}>
                    <a className={styles.actionPrimary} href={reach.linkUrl} target="_blank" rel="noopener noreferrer">
                      {cab.connectTelegram}
                    </a>
                  </div>
                ) : null}
              </article>
            ) : null}
          </div>

          {/* A line, not a fourth card. Installing is a once-per-device act;
              it lives in the footer now, and what stays here is the fact that
              it is available to this account's device. Hides itself on `www`,
              where an install would put the SHOP on the home screen. */}
          <PwaInstallRow copy={cab} />
        </CabinetFold>
      </div>
    </main>
  );
}
