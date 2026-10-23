"use client";

/**
 * «Хроніка» on the profile's overview (G 23.10, after the canvas): what
 * happened to this person, newest first, from data the platform already
 * holds — the last lesson of each course and when it was started, the dosha
 * and balance tests, purchases. Nothing is invented to fill the list: with no
 * events the section is not drawn at all.
 *
 * Lessons are reported per course (its latest activity), not lesson by
 * lesson: the shelf knows where a person is, not every step they took. A
 * fuller history arrives with the timeline's own events, later.
 */

import type { LearnerShelfCourseDto } from "@/components/lms/lmsClient";
import { Icon } from "@/components/Icon";
import type { CwIconName } from "@/components/iconNames";
import { getProfileCopy } from "@/components/platform/profile/copy";
import type { ProfileLang, ProfileResponse } from "@/components/platform/profile/types";

import { getCabinetCopy } from "./copy";
import { fmtDate, formatDoshaResult } from "./format";
import styles from "./Cabinet.module.css";

type Profile = ProfileResponse["profile"];

type Event = { at: string; icon: CwIconName; text: string };

const LIMIT = 6;

export function chronicleEvents({
  lang,
  courses,
  purchases,
  dosha,
  balance,
}: {
  lang: ProfileLang;
  courses: LearnerShelfCourseDto[];
  purchases: Profile["purchases"];
  dosha: Profile["dosha"];
  balance: Profile["balance"];
}): Event[] {
  const cab = getCabinetCopy(lang);
  const copy = getProfileCopy(lang, { productPurchases: 0 });
  const events: Event[] = [];
  for (const course of courses) {
    if (course.lastActivityAt && course.currentLessonTitle) {
      events.push({
        at: course.lastActivityAt,
        icon: "check",
        text: cab.chronicleLesson(course.currentLessonTitle, course.title),
      });
    }
    if (course.startedAt) {
      events.push({ at: course.startedAt, icon: "play", text: cab.chronicleStarted(course.title) });
    }
  }
  if (dosha?.completedAt) {
    events.push({
      at: dosha.completedAt,
      icon: "center",
      text: cab.chronicleDosha(formatDoshaResult(dosha.resultType, lang)),
    });
  }
  if (balance?.completedAt) {
    events.push({
      at: balance.completedAt,
      icon: "ripple",
      text: cab.chronicleBalance(copy.balanceLabels[balance.primary]),
    });
  }
  for (const purchase of purchases) {
    if (purchase.createdAt) {
      events.push({ at: purchase.createdAt, icon: "document", text: cab.chroniclePurchase(purchase.title) });
    }
  }
  return events
    .filter((event) => !Number.isNaN(new Date(event.at).getTime()))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, LIMIT);
}

export function ProfileChronicle({
  lang,
  courses,
  purchases,
  dosha,
  balance,
  dateLocale,
}: {
  lang: ProfileLang;
  courses: LearnerShelfCourseDto[];
  purchases: Profile["purchases"];
  dosha: Profile["dosha"];
  balance: Profile["balance"];
  dateLocale: string;
}) {
  const events = chronicleEvents({ lang, courses, purchases, dosha, balance });
  if (events.length === 0) return null;
  const cab = getCabinetCopy(lang);
  return (
    <section className={styles.chronicle} aria-labelledby="profile-chronicle">
      <h2 id="profile-chronicle" className={styles.sectionTitle}>
        {cab.chronicleTitle}
      </h2>
      <ul className={styles.chronicleList}>
        {events.map((event) => (
          <li key={`${event.at}-${event.text}`} className={styles.chronicleRow}>
            <span className={styles.chronicleWhen}>{fmtDate(event.at, dateLocale)}</span>
            <Icon name={event.icon} size={20} className={styles.chronicleIcon} />
            <span className={styles.chronicleText}>{event.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
