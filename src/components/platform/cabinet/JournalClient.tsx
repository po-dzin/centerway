"use client";

/**
 * The journal, at `/journal` — everything this reader has written, in one place.
 *
 * THE REVERSE SIDE OF THE READER. In a lesson you read somebody else's text and
 * mark it; here you read your own writing and go back to where it came from. So
 * this page is not a second `CourseNotes`: that list lives inside one course and
 * runs in the course's own order, because there the question is «where in this
 * material». With every course in one stream there is no such order left, and
 * the honest axis is time — the day you wrote it.
 *
 * For the same reason the reader's own note stands FIRST in a row and the quote
 * under it. On the course map the passage is the thing being hunted for and the
 * note is what was said about it; in the journal it is the other way round.
 *
 * Nothing here is filtered. An entry whose course window has closed is shown
 * and says so, and an entry whose lesson can no longer be named keeps its text
 * and loses only its link (`buildJournalEntries`). A reader's own words must
 * never disappear because something around them changed.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/Icon";
import { groupJournalByDay } from "@/lms-core";
import { fetchMyJournal, type LearnerJournalDto } from "@/components/lms/lmsClient";
import surfaceStyles from "@/components/platform/PlatformSurfaceStyles";
import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";
import { PlatformPageHead } from "@/components/platform/PlatformPageHead";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import { LEARNING_SHELF_HREF } from "@/lib/platform/content";
import { cabinetGate } from "./CabinetGate";
import { getCabinetCopy } from "./copy";
import { dateLocaleFor } from "./format";
import { useCabinetSession, useProfileLang } from "./useCabinet";
import cabinetStyles from "./Cabinet.module.css";
import styles from "./Journal.module.css";

/**
 * A local day key (`YYYY-MM-DD`) as a heading.
 *
 * Formatted through `Date.UTC` and `timeZone: "UTC"` rather than
 * `new Date("2026-09-10")`: the key was already resolved in the READER'S zone
 * upstream, and handing it to the browser's own zone would move the heading a
 * day for anyone west of UTC — the one bug this whole date path exists to
 * avoid.
 */
function formatDayKey(key: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return "";
  const at = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(at);
}

export function JournalClient() {
  const lang = useProfileLang();
  const cab = getCabinetCopy(lang);
  const locale = dateLocaleFor(lang);
  const href = useSurfaceHref();
  const { session, loading: sessionLoading, signInWithGoogle } = useCabinetSession();

  /**
   * The read is keyed to the ACCOUNT, not to the token.
   *
   * Supabase rotates the access token on its own schedule, and an effect that
   * depended on it would re-read the whole journal every time it did — and,
   * worse, `fetchMyJournal` fetches its own token anyway, so the dependency
   * would buy nothing for the price. Keeping the loaded id beside the data is
   * what makes an account switch honest: the previous reader's entries are not
   * shown for the moment the new read is in flight.
   */
  const [loaded, setLoaded] = useState<{ userId: string; data: LearnerJournalDto } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const userId = session?.user?.id ?? null;

  /* Which read is on screen. Both states are STAMPED with it rather than
     cleared when a new read starts: clearing would mean a setState in the
     effect's own body, and the derived form says the same thing better — a
     failure belongs to the attempt that produced it, so pressing retry or
     signing in as somebody else retires it without anyone having to remember
     to. */
  const read = `${userId ?? ""}:${attempt}`;
  const failed = failure === read;

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    void (async () => {
      const result = await fetchMyJournal();
      if (cancelled) return;
      if (result.ok) setLoaded({ userId, data: result.data });
      else setFailure(read);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, read]);

  const journal = loaded && loaded.userId === userId ? loaded.data : null;

  const days = useMemo(
    () => (journal ? groupJournalByDay(journal.entries, journal.timeZone) : []),
    [journal]
  );

  const loadingView = (
    <main className={surfaceStyles.profileMain} data-cw-platform-template="loading">
      <div className={cabinetStyles.shell}>
        <PlatformLoadingState
          label={cab.learningLabel}
          title={cab.journalLoadingTitle}
          detail={cab.journalLoadingLead}
        />
      </div>
    </main>
  );

  const gate = cabinetGate({
    lang,
    loading: sessionLoading,
    session,
    homeHref: href("/"),
    onSignIn: () => void signInWithGoogle(),
    loadingFallback: loadingView,
  });
  if (gate) return gate;

  // Still reading is not the same as nothing to read — the same branch the
  // shelf keeps, for the same reason: a reader with a full journal must never
  // be told it is empty while the request is in flight.
  if (!failed && journal === null) return loadingView;

  return (
    <main className={surfaceStyles.profileMain} data-cw-platform-template="journal">
      <div className={cabinetStyles.shell}>
        <PlatformPageHead label={cab.learningLabel} title={cab.journalTitle} lead={cab.journalLead} />

        <div className={cabinetStyles.section}>
          {failed ? (
            <div className={styles.state}>
              <h3 className={styles.stateTitle}>{cab.journalErrorTitle}</h3>
              <p className={styles.stateNote}>{cab.journalErrorLead}</p>
              <button
                className={cabinetStyles.actionPrimary}
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
              >
                {cab.retry}
              </button>
            </div>
          ) : days.length === 0 ? (
            <div className={styles.state}>
              <h3 className={styles.stateTitle}>{cab.journalEmptyTitle}</h3>
              <p className={styles.stateNote}>{cab.journalEmptyLead}</p>
              <Link className={cabinetStyles.actionPrimary} href={href(LEARNING_SHELF_HREF)}>
                {cab.allCourses}
              </Link>
            </div>
          ) : (
            days.map((day) => (
              <section className={styles.day} key={day.date || "undated"}>
                <h2 className={styles.dayHeading}>{formatDayKey(day.date, locale) || cab.journalUndated}</h2>

                <ul className={styles.entries}>
                  {day.entries.map((entry) => {
                    const place = entry.course
                      ? [entry.course.title, entry.lesson?.title].filter(Boolean).join(" · ")
                      : cab.journalDetached;

                    return (
                      <li className={styles.entry} key={entry.clientId}>
                        <span className={styles.glyph} aria-hidden="true">
                          <Icon name={entry.kind === "bookmark" ? "bookmark-marked" : "quote"} size={14} />
                        </span>

                        <div className={styles.body}>
                          {entry.note ? <p className={styles.note}>{entry.note}</p> : null}

                          {entry.quote ? (
                            <p className={styles.quote}>{entry.quote}</p>
                          ) : entry.kind === "bookmark" ? (
                            <p className={styles.quote}>{cab.journalBookmark}</p>
                          ) : null}

                          <p className={styles.place}>
                            {entry.path ? (
                              /* Straight to the block. The lesson treats an
                                 explicit hash as «take me here», so it wins
                                 over the saved reading position. The link is
                                 offered even when the window has closed: the
                                 door is the authority on access, and a page
                                 that decided for it would be re-deciding a
                                 contract on a READ path. */
                              <Link className={styles.placeLink} href={href(entry.path)}>
                                {place}
                              </Link>
                            ) : (
                              <span className={styles.placeGone}>{place}</span>
                            )}

                            {entry.course && !entry.course.open ? (
                              <span className={styles.closed}>{cab.journalClosed}</span>
                            ) : null}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
