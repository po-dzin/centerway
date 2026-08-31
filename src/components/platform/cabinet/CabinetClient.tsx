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
import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";
import { Icon } from "@/components/Icon";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import { usePlatformIdentity } from "@/components/platform/layout/usePlatformIdentity";
import { platformRoleLabel } from "@/lib/platform/identity";
import { getProfileCopy } from "@/components/platform/profile/copy";
import { DOSHA_TEST_ROUTE } from "@/lib/platform/tests";
import { LEARNING_SHELF_HREF } from "@/lib/platform/content";
import { PwaInstallRow } from "./PwaInstallCard";
import { cabinetGate } from "./CabinetGate";
import { CabinetFold } from "./CabinetFold";
import { CabinetHero } from "./CabinetHero";
import { AuthorProfileFold } from "./AuthorProfileFold";
import { DoshaWheel } from "./DoshaWheel";
import { CompactCourseCard, ShelfErrorCard, glassMedia, matte } from "./CourseCard";
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
  useAuthorProfile,
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
/**
 * NO SECOND LIST OF COURSES ON THE DASHBOARD (2026-08-28).
 *
 * This screen used to print three more courses under the one being resumed,
 * with «Усі мої курси →» as the fourth row. Three was already a cap on a
 * question this page does not ask: the dashboard answers "what do I open now",
 * and «what do I own» is the library's whole job one tap away. On a phone the
 * three glances were also the difference between a first screen and a scroll.
 *
 * What is left is the one course and the way to the rest. The count has not
 * gone anywhere — «КУРСИ · 9 курсів» stands in the room above, so nothing is
 * silently dropped; the list is simply where lists live.
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
  const identity = usePlatformIdentity(session);
  const { profile, loading: profileLoading, error, clear: clearProfile } = useProfileData(session);
  const { shelf, failed: shelfFailed, reload: reloadShelf } = useLearnerShelf(session);
  const reach = useTelegramReach(session);
  const authorProfile = useAuthorProfile(session);

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
  const productsHref = href("/products");
  const shelfHref = href(LEARNING_SHELF_HREF);
  const homeHref = href("/");

  const ownedCourses = useMemo(
    () => (shelf ?? []).filter((course) => course.access !== "locked"),
    [shelf],
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
    <main className={surfaceStyles.profileMain} data-cw-platform-template="cabinet" data-cw-hero="bleed">
      {/* THE PHOTOGRAPH IS THE SCREEN'S GROUND, so the hero stands OUTSIDE the
          page container: the plate runs edge to edge under the floating bar,
          and only its contents sit on the page's own column. Inside the shell
          it was a picture in a frame with the paper visible around it, which is
          a photograph of a room rather than being in one. */}
        <CabinetHero
          label={copy.profile}
          name={account.fullName ?? copy.fallbackName}
          role={platformRoleLabel(identity.role)}
          email={account.email ?? copy.fallbackEmail}
          notice={
            reach && !reach.linked && reach.linkUrl
              ? { label: cab.notificationsMissing, action: cab.connectTelegram, href: reach.linkUrl }
              : undefined
          }
          avatar={
            account.avatarUrl ? (
              // Remote auth avatars stay on plain img to avoid introducing image config coupling into platform profile.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={account.avatarUrl} alt="" referrerPolicy="no-referrer" />
            ) : (
              getUserInitial(session, account.fullName)
            )
          }
          /* THREE FACTS, ONE ROW. The count came back beside the dosha — a
             room with one dash under «Продукти» and nothing else is a room
             missing a fact, not a room kept clean. What did NOT come back is
             the word «Бібліотека»: that names the ROUTE, and every course it
             used to stand for is printed by name a few centimetres below. */
          stats={[
            { label: copy.dosha, value: formatDoshaResult(dosha?.resultType, lang) },
            {
              label: cab.coursesLabel,
              /* An ellipsis while the shelf is still being read: "—" would
                 claim an empty library to somebody who owns nine courses. */
              value: shelfLoading
                ? "…"
                : ownedCourses.length > 0
                  ? cab.coursesCount(ownedCourses.length)
                  : copy.emptyValue,
            },
            {
              label: copy.products,
              /* "—" is an answer: it means none. */
              value:
                productPurchases.length > 0 ? cab.productsCount(productPurchases.length) : copy.emptyValue,
            },
          ]}
        >
          {/* THE WHOLE FIRST SCREEN IS THE ANSWER, in one row of three: the
              course to resume, the rest of the shelf as glances, and the dosha
              result — the three things this person holds. The dosha used to be
              a card in a section below the photograph, which put a scroll
              between somebody and the test they took. */}
          <div className={styles.shelfRow} data-shelf={ownedCourses.length > 1 ? "courses" : "single"}>
            {resumeCourse ? (
              /* The one answer: cover, where you stopped, and the only control
                 in the row. */
              <CompactCourseCard course={resumeCourse} copy={cab} primary />
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
              <article className={styles.shelfCard} {...glassMedia}>
                <h3 className={styles.shelfCardTitle}>{cab.learningEmptyTitle}</h3>
                <p className={styles.shelfCardNote}>{cab.learningEmptyLead}</p>
                <div className={styles.shelfCardAction}>
                  <Link className={styles.actionPrimary} href={programsHref}>
                    {cab.browsePrograms}
                  </Link>
                </div>
              </article>
            )}

            {/* The way onward, and nothing else in this column. It used to
                stand at the end of three more courses; with those gone it is
                what it always was — one crossing, to the place the whole shelf
                lives. */}
            {ownedCourses.length > 1 ? (
              <Link className={styles.glanceMore} href={shelfHref}>
                <span className={styles.glanceMoreText}>{cab.allCourses}</span>
                <Icon className={styles.glanceMoreArrow} name="arrow-right" size={20} />
              </Link>
            ) : null}

            {/* The dosha RESULT, not the tests catalogue. What the test is and
                what else exists is the showcase's business — this tile holds
                the answer that belongs to this person, at the size of a glance
                rather than of a card: the shape, the type, one way back in. */}
            <article className={styles.shelfAside} {...glassMedia}>
              <p className={styles.sectionLabel}>{copy.dosha}</p>
              {dosha ? (
                <>
                  {/* The shape, the type and the three scores — three
                      horizontal meters cost a card's width to say the same
                      thing less densely. See `DoshaWheel`. */}
                  <DoshaWheel
                    scores={dosha.scores ?? { vata: 0, pitta: 0, kapha: 0 }}
                    labels={copy.doshaLabels}
                    resultLabel={formatDoshaResult(dosha.resultType, lang)}
                    lang={lang}
                  />
                  <p className={styles.shelfCardMeta}>
                    {copy.completedShort} {fmtDate(dosha.completedAt, dateLocale)}
                  </p>
                </>
              ) : (
                <p className={styles.shelfCardNote}>{copy.doshaEmptyLead}</p>
              )}
              <div className={styles.shelfCardAction}>
                <Link className={dosha ? styles.actionGhost : styles.actionPrimary} href={doshaTestHref}>
                  {dosha ? copy.retakeTest : copy.startTest}
                </Link>
              </div>
            </article>
          </div>
        </CabinetHero>

      <div className={styles.shell}>

        {/* A receipt is reference, not the answer the dashboard exists to give.
            It remains folded until the reader asks for it at every viewport. */}
        <CabinetFold label={copy.products} title={copy.productsTitle} lead={copy.productsLead}>
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
                {/* The PRODUCTS catalogue, from the products fold. It offered
                    programmes, which is an answer to a question this fold does
                    not ask — and the one place on the page where a reader is
                    told they own no products is the worst place to change the
                    subject. */}
                <Link className={styles.actionPrimary} href={productsHref}>
                  {cab.browseProducts}
                </Link>
              </div>
            </article>
          )}
        </CabinetFold>

        {authorProfile.eligible && session ? (
          <AuthorProfileFold
            session={session}
            author={authorProfile.author}
            saving={authorProfile.saving}
            save={authorProfile.save}
            lang={lang}
          />
        ) : null}

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
