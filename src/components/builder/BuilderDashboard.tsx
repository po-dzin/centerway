"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { BUILDER_COURSES_PATH } from "@/lib/surfaces/catalog";
import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import { CourseStateBadge } from "@/components/platform/StateBadge";
import type { CourseStateKey } from "@/lib/lms/courseState";
import { plural } from "@/lib/plural";
import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";
import { PlatformPageHead } from "@/components/platform/PlatformPageHead";
import { BuilderActivityChart } from "./BuilderActivityChart";
import { BuilderFailureNotice, BuilderShell } from "./BuilderShell";
import { BuilderWorkshopRail } from "./BuilderWorkshopRail";
import {
  listAuthoringActivity,
  listAuthoringAudience,
  listCourses,
  type BuilderActivityEntry,
  type BuilderAudienceDay,
  type BuilderCourseAudience,
  type BuilderCourseSummary,
  type BuilderFailure,
} from "./builderClient";
import {
  blockerLine,
  formatShare,
  journalWhen,
  learnersCount,
  overviewStateKeys,
  summarizeAudience,
  visibilityShort,
  waitingFor,
  type AudienceTotals,
} from "./builderOverview";
import { COURSE_WORKSPACE_HASH } from "./courseWorkspace";
import { REVISION_KIND_LABELS } from "./versionHistory";
import styles from "./Builder.module.css";

/**
 * The author's own start surface.
 *
 * THE SPLIT IT COMPLETES. The personal app already separates «where am I»
 * (`/profile`) from «what do I have» (`/learn`), and the workshop had only the
 * second half: opening `Майстерня` dropped an author straight into a list of
 * course titles, which answers «які курси існують» and none of the questions an
 * author actually arrives with. Those questions are about the courses' STANDING
 * — what is waiting on someone else, what strangers can see, what is stopping a
 * publish — and a list of titles cannot hold them without turning every row
 * into a status console.
 *
 * FIVE BLOCKS, EACH IN THE SHAPE OF ITS DATA (2026-09-17). The first version
 * was five panels of sentences and refused a counter strip on principle; on
 * real data it read as a wall of text. What survived that principle is the
 * part that was right — a number never stands without its comparison — so the
 * tiles each carry one («із 12», «+3 за 30 днів»). In reading order:
 *
 * 1. what needs the author — review, returns, blockers — first, because it is
 *    the only block that asks them to act;
 * 2. four tiles — seats, active this week, lessons finished this week, mean
 *    progress — the numbers course platforms lead with, restricted to what our
 *    tables actually hold;
 * 3. one chart — distinct readers per day for a month — the one thing here
 *    that changes over time;
 * 4. a course table — standing, visibility, audience, progress, blockers per
 *    course — because «which course» is a row and «which fact» a column;
 * 5. the journal, as a short table with the rest behind «Показати всі».
 *
 * NO INVENTED METRICS, AND NO MONEY. Sales and revenue are not read anywhere
 * here: the price lives in `lms_course_offers` behind an admin-only policy
 * (`docs/creator-contract-2026-08-22.md`). Learner numbers ARE here, because
 * enrolment and progress rows genuinely carry them — but only as counts per
 * course (`authorAudience.ts`); no name, account or email crosses into this
 * screen. True sections beat plausible-looking zeros.
 *
 * NOT A SECOND EDITOR. Every entry is a link into the course workspace at the
 * hash that owns the answer — release for a blocker, the course itself for a
 * change. The dashboard states standing; it never edits it.
 */

type State =
  | { status: "loading" }
  | { status: "failed"; failure: BuilderFailure; detail?: string }
  | {
      status: "ready";
      courses: BuilderCourseSummary[];
      /** `null` when the journal did not load — not the same as an empty one. */
      activity: BuilderActivityEntry[] | null;
      /** Counts per slug, or `null` when they did not load. Never an identity — see the audience route. */
      audience: Record<string, BuilderCourseAudience> | null;
      /** Distinct readers per day; `null` exactly when `audience` is. */
      days: BuilderAudienceDay[] | null;
    };

function courseHref(slug: string, mode: keyof typeof COURSE_WORKSPACE_HASH): string {
  return `/build/${slug}${COURSE_WORKSPACE_HASH[mode]}`;
}

export function BuilderDashboard() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    /* Guarded, and the await comes first: a synchronous setState inside an
       effect costs a cascading render for the state the component already
       starts in. Same shape as the shelf and the learner surfaces. */
    let cancelled = false;
    void (async () => {
      /* TWO READS, ONE SCREEN, IN PARALLEL. The journal is a different table
         behind a different route and it must not delay the standing of the
         courses — but a screen that renders in two steps flickers, so both are
         awaited together and committed once. */
      const [courses, activity, audience] = await Promise.all([
        listCourses(),
        listAuthoringActivity(),
        listAuthoringAudience(),
      ]);
      if (cancelled) return;
      if (!courses.ok) {
        setState({ status: "failed", failure: courses.failure, detail: courses.detail });
        return;
      }
      setState({
        status: "ready",
        courses: courses.data.courses,
        /* A SECTION THAT DID NOT LOAD FAILS ALONE, and says so. The courses are
           the screen; the journal and the audience are sections of it, and
           failing the whole dashboard because one of those reads timed out
           would hide the answers that did arrive. But an unread section is not
           an empty one: «жоден курс не має учнів» after a 500 is a false zero,
           so a failure stays `null` and the section names it. */
        activity: activity.ok ? activity.data.activity : null,
        audience: audience.ok ? audience.data.audience : null,
        days: audience.ok ? audience.data.days : null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* THE FRAME BEFORE THE CONTENT. Loading and failure render the same three
     tracks as the ready state: a shell that gains its left rail only once the
     fetch lands moves the document sideways at exactly the moment the author
     starts reading it. */
  const rail = <BuilderWorkshopRail current="overview" />;

  if (state.status === "loading") {
    return (
      <BuilderShell aside={rail}>
        <PlatformLoadingState
          label="Майстерня"
          title="Збираємо стан ваших курсів…"
          detail="Учні, перевірка, блокери та останні зміни."
        />
      </BuilderShell>
    );
  }

  if (state.status === "failed") {
    return (
      <BuilderShell aside={rail}>
        <BuilderFailureNotice failure={state.failure} detail={state.detail} scope="shelf" />
      </BuilderShell>
    );
  }

  const { courses, activity, audience, days } = state;
  const reviewing = courses.filter(
    (course) => course.reviewStatus === "in_review" || course.reviewStatus === "changes_requested",
  );
  const blocked = courses.filter(
    (course) => course.blockerCount !== 0 && !reviewing.some((entry) => entry.slug === course.slug),
  );
  const totals = audience ? summarizeAudience(Object.values(audience)) : null;

  return (
    /* NO TRAIL. This IS the workshop's root, and `BuilderShell` derives the
       phone's leading island from the trail's parent — a root that names itself
       as its own parent gave the overview a back arrow pointing at the overview.

       THE RAIL IS THE FRAME, NOT A FEATURE. With an `aside` the shell lays out
       `.bodyWithAside` — three tracks, the outer two reserved at the panel width
       whatever is in them — which is the same axis the course workspace and the
       lesson editor stand on. */
    <BuilderShell aside={rail}>
      <PlatformPageHead
        label="Майстерня"
        title="Огляд"
        lead="Як ідуть ваші курси: хто їх проходить, що чекає на вас і що змінювалось."
        actions={
          /* THE ONLY ACTION, and it is a route rather than a command. Creating
             a course belongs to the shelf, where the courses are. */
          <Link className={styles.overviewTextAction} href={BUILDER_COURSES_PATH} data-cw-ink-control>
            <InteractionInkLabel variant="link">Матеріали</InteractionInkLabel>
          </Link>
        }
      />

      {courses.length === 0 ? (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Тут поки порожньо</h2>
          <p className={styles.panelText}>
            Коли у вас з&apos;явиться курс, на цьому екрані будуть його учні, перевірка, блокери й останні зміни.
          </p>
        </section>
      ) : (
        <div className={styles.overviewSections}>
          <OverviewPanel
            title="Потребує уваги"
            empty={
              reviewing.length + blocked.length === 0 ? "Нічого не чекає на вас: перевірок і блокерів немає." : null
            }
          >
            <ul className={styles.overviewList}>
              {reviewing.map((course) => (
                <OverviewEntry
                  key={course.slug}
                  title={course.title}
                  href={courseHref(course.slug, "release")}
                  states={overviewStateKeys(course)}
                  line={
                    course.reviewStatus === "in_review"
                      ? waitingFor(course.submittedAt)
                      : /* The reviewer's own words, verbatim. */
                        (course.reviewNote ?? "Рецензент попросив зміни без коментаря.")
                  }
                />
              ))}
              {blocked.map((course) => (
                <OverviewEntry
                  key={course.slug}
                  title={course.title}
                  href={courseHref(course.slug, "release")}
                  states={overviewStateKeys(course)}
                  line={blockerLine(course.blockerCount)}
                />
              ))}
            </ul>
          </OverviewPanel>

          {/* COUNTS, NEVER PEOPLE. Audience size is the author's own question
              about their own work; no name, account or email is fetched or
              rendered. Money is not here: the price lives behind an admin-only
              policy. */}
          {totals && days ? (
            <>
              <OverviewTiles totals={totals} />
              <OverviewPanel
                title="Активність учнів"
                lead="Скільки людей відкривали уроки, за день · останні 30 днів"
                empty={null}
              >
                <BuilderActivityChart days={days} />
              </OverviewPanel>
            </>
          ) : (
            <OverviewPanel title="Учні" empty={SECTION_UNAVAILABLE} />
          )}

          <OverviewPanel
            title="Курси"
            lead="Учні — з відкритим доступом · активні — за останні 7 днів · прогрес — середня частка пройдених уроків"
            empty={null}
          >
            <div className={styles.overviewTableScroll}>
              <table className={styles.overviewTable} data-table="courses">
                <thead>
                  <tr>
                    <th scope="col">Курс</th>
                    <th scope="col" data-numeric>
                      Учні
                    </th>
                    <th scope="col" data-numeric>
                      Активні
                    </th>
                    <th scope="col" data-numeric>
                      Прогрес
                    </th>
                    <th scope="col" data-numeric>
                      Пройшли
                    </th>
                    <th scope="col" data-numeric>
                      Блокери
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course) => {
                    const entry = audience?.[course.slug];
                    const offered = course.status === "published" || (entry?.learners ?? 0) > 0;
                    return (
                      <tr key={course.slug}>
                        <td data-cell="course">
                          <span className={styles.overviewCourseCell}>
                            <Link
                              className={styles.overviewName}
                              href={courseHref(course.slug, "course")}
                              title={course.title}
                              data-cw-ink-control
                            >
                              <InteractionInkLabel variant="navigation">{course.title}</InteractionInkLabel>
                            </Link>
                            <span className={styles.overviewItemState}>
                              {overviewStateKeys(course).map((key) => (
                                <CourseStateBadge key={key} state={key} lang="uk" />
                              ))}
                              {course.status === "published" ? (
                                <span className={styles.overviewItemNote}>{visibilityShort(course.visibility)}</span>
                              ) : null}
                            </span>
                          </span>
                        </td>
                        <NumberCell label="Учні" value={entry && offered ? entry.learners : null} />
                        <NumberCell label="Активні" value={entry && offered ? entry.activeRecently : null} />
                        <NumberCell
                          label="Прогрес"
                          value={
                            entry && offered && entry.progressShare !== null ? formatShare(entry.progressShare) : null
                          }
                        />
                        <NumberCell
                          label="Пройшли"
                          value={entry && offered && entry.progressShare !== null ? entry.finished : null}
                        />
                        <NumberCell
                          label="Блокери"
                          value={
                            course.blockerCount < 0 ? "помилка" : course.blockerCount === 0 ? null : course.blockerCount
                          }
                        />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </OverviewPanel>

          <OverviewJournal activity={activity} />
        </div>
      )}
    </BuilderShell>
  );
}

/** What a section says when its own read failed — never its empty sentence. */
const SECTION_UNAVAILABLE = "Не вдалося завантажити цей розділ. Оновіть сторінку трохи згодом.";

/** How many journal rows show before «Показати всі». */
const JOURNAL_PREVIEW = 5;

/**
 * One question, one answer.
 *
 * `empty` is not an optional nicety: a section that renders nothing when it has
 * nothing looks identical to a section that failed to load. So the section
 * always occupies its place and always says something.
 */
function OverviewPanel({
  title,
  lead,
  empty,
  action,
  children,
}: {
  title: string;
  lead?: string;
  empty: string | null;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.overviewSectionHead}>
        <h2 className={styles.panelTitle}>{title}</h2>
        {action}
      </div>
      {lead ? <p className={styles.overviewSectionLead}>{lead}</p> : null}
      {empty ? <p className={styles.panelText}>{empty}</p> : children}
    </section>
  );
}

/**
 * The four numbers, each with the comparison that makes it mean something.
 *
 * Seats, not people: a person in two courses is two seats, the same way every
 * course row counts them. Only the chart deduplicates people, and it says so.
 */
function OverviewTiles({ totals }: { totals: AudienceTotals }) {
  const none = totals.learners === 0;
  return (
    <dl className={styles.overviewTiles}>
      <OverviewTile
        label="Учні"
        value={totals.learners}
        note={
          totals.joinedRecently > 0
            ? `+${totals.joinedRecently} за 30 днів`
            : none
              ? "доступ поки ні в кого не відкритий"
              : "нових за 30 днів немає"
        }
      />
      <OverviewTile
        label="Активні за тиждень"
        value={totals.activeRecently}
        note={none ? "—" : `із ${learnersCount(totals.learners)} з відкритим доступом`}
      />
      <OverviewTile
        label="Пройдено уроків за тиждень"
        value={totals.completionsRecently}
        note={
          totals.finished > 0
            ? `${learnersCount(totals.finished)} ${plural(totals.finished, "пройшов", "пройшли", "пройшли")} курс повністю`
            : "курс повністю ще ніхто не пройшов"
        }
      />
      <OverviewTile
        label="Середній прогрес"
        value={formatShare(totals.progressShare)}
        note={
          none
            ? "учнів поки немає"
            : totals.notStarted > 0
              ? `${learnersCount(totals.notStarted)} ще не ${plural(totals.notStarted, "почав", "почали", "почали")}`
              : "усі учні вже почали"
        }
      />
    </dl>
  );
}

function OverviewTile({ label, value, note }: { label: string; value: number | string; note: string }) {
  return (
    <div className={styles.overviewTile}>
      <dt className={styles.overviewTileLabel}>{label}</dt>
      <dd className={styles.overviewTileValue}>{value}</dd>
      <dd className={styles.overviewTileNote}>{note}</dd>
    </div>
  );
}

/** A number, or a quiet dash where the fact does not apply (a draft nobody was given). */
/* `data-label` is the column's name, printed beside the value only where the
   phone drops the header row and each row becomes a short block. */
function NumberCell({ label, value }: { label: string; value: number | string | null }) {
  return value === null ? (
    <td data-numeric data-muted data-label={label}>
      —
    </td>
  ) : (
    <td data-numeric data-label={label}>
      {value}
    </td>
  );
}

/**
 * The journal as a table: when, which course, what, who.
 *
 * The first rows are the answer to «що змінювалось нещодавно»; the rest are
 * behind a text action so the journal does not become the longest block on a
 * page whose job is standing.
 */
function OverviewJournal({ activity }: { activity: BuilderActivityEntry[] | null }) {
  const [expanded, setExpanded] = useState(false);
  const entries = activity ?? [];
  const shown = expanded ? entries : entries.slice(0, JOURNAL_PREVIEW);
  const hidden = entries.length - shown.length;

  return (
    <OverviewPanel
      title="Останні зміни"
      empty={
        activity === null
          ? SECTION_UNAVAILABLE
          : entries.length === 0
            ? "Журнал поки порожній. Тут з'являються надсилання на перевірку, публікації, відновлення та версії, збережені вручну."
            : null
      }
      action={
        entries.length > JOURNAL_PREVIEW ? (
          <button
            type="button"
            className={styles.overviewTextAction}
            data-cw-ink-control
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            <InteractionInkLabel variant="link">
              {expanded ? "Згорнути" : `Показати всі (${entries.length})`}
            </InteractionInkLabel>
          </button>
        ) : null
      }
    >
      <div className={styles.overviewTableScroll}>
        <table className={styles.overviewTable} data-table="journal">
          <thead>
            <tr>
              <th scope="col">Коли</th>
              <th scope="col">Курс</th>
              <th scope="col">Подія</th>
              <th scope="col">Хто</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((entry) => (
              <tr key={entry.id}>
                <td className={styles.overviewTableWhen} data-cell="when">
                  {journalWhen(entry.createdAt)}
                </td>
                <td data-cell="course">
                  <Link
                    className={styles.overviewName}
                    href={courseHref(entry.slug, "course")}
                    title={entry.courseTitle}
                    data-cw-ink-control
                  >
                    <InteractionInkLabel variant="navigation">{entry.courseTitle}</InteractionInkLabel>
                  </Link>
                </td>
                <td data-cell="event">
                  <span className={styles.overviewCourseCell}>
                    <span>
                      {REVISION_KIND_LABELS[entry.kind]} · №{entry.revisionNumber}
                    </span>
                    {entry.label ? <span className={styles.overviewItemNote}>{entry.label}</span> : null}
                  </span>
                </td>
                <td data-muted data-cell="who">
                  {entry.actor ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hidden > 0 ? <span className={styles.visuallyHidden}>Ще {hidden} записів приховано.</span> : null}
    </OverviewPanel>
  );
}

/**
 * A line of text, not a card — for what needs the author.
 *
 * The name is the link and carries the ink stroke on hover and focus only; the
 * state and the detail sit under it as plain text.
 */
function OverviewEntry({
  title,
  href,
  states,
  line,
}: {
  title: string;
  href: string;
  /** Lifecycle words from `courseStateKeys` — the same badges every surface prints. */
  states?: CourseStateKey[];
  line: string;
}) {
  return (
    <li className={styles.overviewItem}>
      <Link className={styles.overviewName} href={href} data-cw-ink-control>
        <InteractionInkLabel variant="navigation">{title}</InteractionInkLabel>
      </Link>
      <span className={styles.overviewItemState}>
        {states?.map((state) => (
          <CourseStateBadge key={state} state={state} lang="uk" />
        ))}
        <span className={styles.overviewItemLine}>{line}</span>
      </span>
    </li>
  );
}
