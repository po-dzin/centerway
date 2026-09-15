"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { BUILDER_COURSES_PATH } from "@/lib/surfaces/catalog";
import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import { CourseStateBadge } from "@/components/platform/StateBadge";
import type { CourseStateKey } from "@/lib/lms/courseState";
import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";
import { PlatformPageHead } from "@/components/platform/PlatformPageHead";
import { BuilderFailureNotice, BuilderShell } from "./BuilderShell";
import { BuilderWorkshopRail } from "./BuilderWorkshopRail";
import {
  listAuthoringActivity,
  listAuthoringAudience,
  listCourses,
  type BuilderActivityEntry,
  type BuilderCourseAudience,
  type BuilderCourseSummary,
  type BuilderFailure,
} from "./builderClient";
import {
  audienceLine,
  audienceNote,
  blockerLine,
  overviewStateKeys,
  visibilityLine,
  waitingFor,
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
 * FIVE QUESTIONS, FIVE SECTIONS, AND NOTHING ELSE. Each section is one question
 * with one answer, in the order an author would ask them: what is out of my
 * hands, what is live, who is inside it, what is stuck, what did I touch. There is deliberately
 * no counter strip across the top — «Дашборд / карта прогресу» fails by
 * becoming a data readout that says everything and orients nobody, and a number
 * without the course it belongs to is exactly that.
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

const journalDate = new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" });

type State =
  | { status: "loading" }
  | { status: "failed"; failure: BuilderFailure; detail?: string }
  | {
      status: "ready";
      courses: BuilderCourseSummary[];
      activity: BuilderActivityEntry[];
      /** Counts per slug. Never an identity — see the audience route. */
      audience: Record<string, BuilderCourseAudience>;
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
        /* A JOURNAL THAT DID NOT LOAD IS AN EMPTY JOURNAL HERE, and that is a
           deliberate asymmetry. The courses are the screen; the journal is one
           section of it, and failing the whole dashboard because a history
           query timed out would hide the three answers that did arrive. The
           section states its own emptiness in words either way. */
        activity: activity.ok ? activity.data.activity : [],
        audience: audience.ok ? audience.data.audience : {},
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
          detail="Перевірка, публікація, блокери та останні зміни."
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

  const { courses, activity, audience } = state;
  const inReview = courses.filter((course) => course.reviewStatus === "in_review");
  const needsChanges = courses.filter((course) => course.reviewStatus === "changes_requested");
  const published = courses.filter((course) => course.status === "published");
  const blocked = courses.filter((course) => course.blockerCount !== 0);
  /* ONLY COURSES SOMEBODY HAS ACTUALLY ENTERED. A draft nobody has been given
     yet is not «0 учнів» — it is a course that has not been offered, and a row
     of zeroes for every unpublished draft would bury the one course that does
     have readers. A course whose seats have all lapsed still belongs here: that
     is a real fact about a real audience. */
  const withAudience = courses.flatMap((course) => {
    const entry = audience[course.slug];
    if (!entry || entry.learners + entry.lapsed === 0) return [];
    return [{ course, entry }];
  });

  return (
    /* NO TRAIL. This IS the workshop's root, and `BuilderShell` derives the
       phone's leading island from the trail's parent — a root that names itself
       as its own parent gave the overview a back arrow pointing at the overview.
       The mark belongs in that corner here; `PlatformPageHead` already says
       «МАЙСТЕРНЯ / Огляд» for the "where am I" question.

       THE RAIL IS THE FRAME, NOT A FEATURE. With an `aside` the shell lays out
       `.bodyWithAside` — three tracks, the outer two reserved at the panel width
       whatever is in them — which is the same axis the course workspace and the
       lesson editor stand on. Without one the page centres in the full width and
       the document jumps sideways the moment an author opens a course. */
    <BuilderShell aside={rail}>
      <PlatformPageHead
        label="Майстерня"
        title="Огляд"
        lead="Що зараз відбувається з вашими курсами: що чекає на перевірку, хто їх читає, що заважає публікації."
        actions={
          /* THE ONLY ACTION, and it is a route rather than a command. Creating
             a course belongs to the shelf, where the courses are; a gold button
             here would be a second «головна дія» on a screen whose job is to
             report. */
          <Link className={styles.overviewShelfAction} href={BUILDER_COURSES_PATH} data-cw-ink-control>
            <InteractionInkLabel variant="link">Матеріали</InteractionInkLabel>
          </Link>
        }
      />

      {courses.length === 0 ? (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Тут поки порожньо</h2>
          <p className={styles.panelText}>
            Коли у вас з&apos;явиться курс, на цьому екрані буде його стан: перевірка, публікація, блокери й останні
            зміни.
          </p>
        </section>
      ) : (
        <div className={styles.overviewSections}>
          <OverviewSection
            title="Перевірка"
            empty={inReview.length + needsChanges.length === 0 ? "Зараз нічого не чекає на перевірку." : null}
          >
            {inReview.map((course) => (
              <OverviewEntry
                key={course.slug}
                title={course.title}
                href={courseHref(course.slug, "release")}
                states={overviewStateKeys(course)}
                line={waitingFor(course.submittedAt)}
              />
            ))}
            {needsChanges.map((course) => (
              <OverviewEntry
                key={course.slug}
                title={course.title}
                href={courseHref(course.slug, "release")}
                states={overviewStateKeys(course)}
                /* The reviewer's own words, verbatim. A generic «перевірку не
                   пройдено» would send the author back to ask what exactly. */
                line={course.reviewNote ?? "Рецензент попросив зміни без коментаря."}
              />
            ))}
          </OverviewSection>

          <OverviewSection title="Опубліковані" empty={published.length === 0 ? "Жодного опублікованого курсу." : null}>
            {published.map((course) => (
              <OverviewEntry
                key={course.slug}
                title={course.title}
                href={courseHref(course.slug, "release")}
                states={overviewStateKeys(course)}
                line={visibilityLine(course.visibility)}
              />
            ))}
          </OverviewSection>

          {/* WHOSE QUESTION THIS IS. Audience size is the author's own question
              about their own work — «чи читає це хтось» — and it is the one
              number they would otherwise have to ask an administrator for. It
              stops at counts: no name, no account, no email is fetched or
              rendered, which is the annotation privacy rule held one level up.
              Money is NOT here and cannot be: the price lives in
              `lms_course_offers` behind an admin-only policy. */}
          <OverviewSection title="Учні" empty={withAudience.length === 0 ? "Поки жоден курс не має учнів." : null}>
            {withAudience.map(({ course, entry }) => (
              <OverviewEntry
                key={course.slug}
                title={course.title}
                href={courseHref(course.slug, "course")}
                line={audienceLine(entry)}
                note={audienceNote(entry)}
              />
            ))}
          </OverviewSection>

          <OverviewSection
            title="Що заважає опублікувати"
            empty={blocked.length === 0 ? "Блокерів публікації немає." : null}
          >
            {blocked.map((course) => (
              <OverviewEntry
                key={course.slug}
                title={course.title}
                href={courseHref(course.slug, "release")}
                line={blockerLine(course.blockerCount)}
              />
            ))}
          </OverviewSection>

          <OverviewSection
            title="Останні зміни"
            empty={
              activity.length === 0
                ? "Журнал поки порожній. Тут з'являються надсилання на перевірку, публікації, відновлення та версії, збережені вручну."
                : null
            }
          >
            {activity.map((entry) => (
              /* NO PILL HERE, unlike the three status sections above. The pill
                 is `white-space: nowrap` and the kind labels are phrases —
                 «Автоматична контрольна точка» is a 28-character capsule that
                 would push a phone's line sideways to say something that reads
                 perfectly well as text. A capsule is for a one-word standing. */
              <OverviewEntry
                key={entry.id}
                title={entry.courseTitle}
                href={courseHref(entry.slug, "course")}
                line={[
                  REVISION_KIND_LABELS[entry.kind],
                  `№${entry.revisionNumber}`,
                  journalDate.format(new Date(entry.createdAt)),
                  /* The name last: kind and time answer «що і коли», the name
                     answers «хто», and it is the part a system entry lacks. */
                  entry.actor,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                note={entry.label}
              />
            ))}
          </OverviewSection>
        </div>
      )}
    </BuilderShell>
  );
}

/**
 * One question, one answer.
 *
 * `empty` is not an optional nicety: a section that renders nothing when it has
 * nothing looks identical to a section that failed to load, and the whole point
 * of «на перевірці» is that an author can tell «нічого не чекає» from «я не
 * знаю». So the section always occupies its place and always says something.
 */
function OverviewSection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string | null;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>{title}</h2>
      {empty ? <p className={styles.panelText}>{empty}</p> : <ul className={styles.overviewList}>{children}</ul>}
    </section>
  );
}

/**
 * A line of text, not a card.
 *
 * The name is the link and carries the ink stroke at rest strength; the state
 * and the detail sit under it as plain text. A plate here would have made four
 * ruled lists into twenty pressable-looking tiles — the failure «A list is text,
 * not a stack of cards» names.
 */
function OverviewEntry({
  title,
  href,
  states,
  line,
  note,
}: {
  title: string;
  href: string;
  /** Lifecycle words from `courseStateKeys` — the same badges every surface prints. */
  states?: CourseStateKey[];
  line: string;
  /** A second fact that qualifies the first — a label, a waiting version. */
  note?: string | null;
}) {
  return (
    <li className={styles.overviewItem}>
      <Link className={styles.overviewName} href={href} data-cw-ink-control>
        <InteractionInkLabel variant="link">{title}</InteractionInkLabel>
      </Link>
      <span className={styles.overviewItemState}>
        {states?.map((state) => (
          <CourseStateBadge key={state} state={state} lang="uk" />
        ))}
        <span className={styles.overviewItemLine}>{line}</span>
      </span>
      {note ? <span className={styles.overviewItemNote}>{note}</span> : null}
    </li>
  );
}
