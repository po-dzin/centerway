"use client";

/**
 * "You already own this" banner for an offer page.
 *
 * Without it a paying learner who lands on /programs/reset-day — from search, a
 * bookmark, or the platform's own catalog — is shown a sales page for a course
 * they already bought, with a form asking them to enquire about buying it.
 *
 * Deliberately silent in every uncertain case: while loading, when signed out,
 * when the shelf read fails, or when the course is not owned. A sales page that
 * flickers a wrong banner is worse than one that never shows it, and anonymous
 * visitors must see the pitch exactly as before.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchMyCourses, type LearnerShelfCourseDto } from "@/components/lms/lmsClient";
import { resolvePlatformHref } from "@/components/platform/layout/usePlatformHref";
import styles from "./OwnedCourseNotice.module.css";

export function OwnedCourseNotice({ programSlug }: { programSlug: string }) {
  const [owned, setOwned] = useState<LearnerShelfCourseDto | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await fetchMyCourses();
      if (cancelled || !result.ok) return;

      const match = result.data.courses.find(
        (course) => course.programSlug === programSlug && course.access !== "locked"
      );
      if (match) setOwned(match);
    })();

    return () => {
      cancelled = true;
    };
  }, [programSlug]);

  if (!owned) return null;

  const finished = owned.standing?.isFinished ?? false;
  const href =
    owned.access === "enrolled" && owned.currentLessonSlug && !finished
      ? `/learn/${owned.slug}/${owned.currentLessonSlug}`
      : `/learn/${owned.slug}`;

  const action = owned.access === "available" ? "Почати курс" : finished ? "Відкрити курс" : "Продовжити";

  return (
    <section className={styles.wrap} aria-label="Ваш доступ до цієї програми">
      <div className={styles.card}>
        <div className={styles.text}>
          <p className={styles.label}>Доступ уже відкрито</p>
          <p className={styles.lead}>
            {owned.access === "available"
              ? "Ця програма вже ваша — курс чекає в кабінеті."
              : finished
                ? "Ви вже пройшли цей курс. Протокол можна повторити будь-коли."
                : owned.currentLessonTitle
                  ? `Наступний урок: ${owned.currentLessonTitle}`
                  : "Курс уже відкритий у вашому кабінеті."}
          </p>
        </div>
        <Link className={styles.action} href={resolvePlatformHref(href)}>
          {action}
        </Link>
      </div>
    </section>
  );
}
