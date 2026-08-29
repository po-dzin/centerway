"use client";

/**
 * The «Автор» tab — everything about the byline this course prints, in one
 * place, matching what `OfferAuthor` (`src/components/platform/OfferFacets.tsx`)
 * actually renders: photo, name, role, `authorNote`, and a link to the public
 * profile only when it is `listed`. Bio and credentials are NOT shown here for
 * the same reason they are not on the offer page — they only ever appear on
 * `/expert/[slug]`, one click away.
 *
 * WHAT THIS TAB CANNOT EDIT. The name, photo, bio and credentials live in
 * `lms_authors`, one row per person, self-managed from the cabinet
 * (`/profile`) — see `src/components/platform/cabinet/AuthorProfileFold.tsx`.
 * Editing them here would be a second form writing the same row a different
 * course's author tab also writes, disagreeing the day the two drift. This
 * tab only holds `authorNote` (the one field that is genuinely PER COURSE) and
 * the link itself — which profile, if any, this course's byline points at.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

import { Icon } from "@/components/Icon";
import type { Course } from "@/lms-core";
import { loadCourseAuthorLink, setCourseAuthorLink, type CourseAuthorLinkDto } from "./builderClient";
import { FieldInput } from "./BuilderFields";
import styles from "./Builder.module.css";

/**
 * The read is stamped with the slug it answers, the same pattern the
 * cabinet's `useProfileData` uses — deriving "still loading" from a mismatch
 * rather than setting a loading flag inside the effect body, which is a
 * synchronous `setState` React's effect linter refuses.
 */
type Read = { slug: string | null; data: CourseAuthorLinkDto | null; failed: boolean };

export function BuilderCourseAuthor({
  course,
  slug,
  onChange,
}: {
  course: Course;
  slug: string;
  onChange: (path: (string | number)[], value: unknown) => void;
}) {
  const [read, setRead] = useState<Read>({ slug: null, data: null, failed: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await loadCourseAuthorLink(slug);
      if (cancelled) return;
      setRead(result.ok ? { slug, data: result.data, failed: false } : { slug, data: null, failed: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function apply(action: "attach-self" | "detach") {
    setBusy(true);
    const result = await setCourseAuthorLink(slug, action);
    setBusy(false);
    if (result.ok) {
      setRead((prev) =>
        prev.data ? { ...prev, data: { ...prev.data, linkedAuthor: result.data.linkedAuthor, linkedAuthorId: result.data.linkedAuthorId } } : prev
      );
    }
  }

  const data = read.slug === slug ? read.data : null;
  const failed = read.slug === slug && read.failed;
  const loading = !data && !failed;
  const linked = data?.linkedAuthor ?? null;
  const isSelf = Boolean(data?.ownAuthor && data?.linkedAuthorId === data?.ownAuthor?.id);

  return (
    <div className={styles.settingsForm}>
      {/* THE PREVIEW SITS FIRST, because it is the answer to the tab's own
          question — "who's on the page" — and everything below it is either how
          that got decided or the one line that changes it. */}
      <section className={styles.courseSettingSection}>
        <div className={styles.courseSettingCopy}>
          <h3 className={styles.courseSettingTitle}>На сторінці програми</h3>
        </div>

        {loading ? (
          <p className={styles.readOnlyNote}>Завантаження…</p>
        ) : failed ? (
          <p className={styles.readOnlyNote}>Не вдалося прочитати профіль автора. Спробуйте оновити сторінку.</p>
        ) : linked || course.authorNote ? (
          <div className={styles.authorPreviewCard}>
            {linked?.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.authorPreviewPhoto} src={linked.photo.src} alt={linked.photo.alt} />
            ) : null}
            <div className={styles.authorPreviewBody}>
              {linked ? <p className={styles.authorPreviewName}>{linked.name}</p> : null}
              {linked?.role ? <p className={styles.authorPreviewRole}>{linked.role}</p> : null}
              {course.authorNote ? <p className={styles.readOnlyNote}>{course.authorNote}</p> : null}
              {linked?.listed ? (
                <Link
                  className={styles.authorPreviewCue}
                  href={`/expert/${linked.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Про автора <Icon name="arrow-right" size={16} />
                </Link>
              ) : null}
            </div>
          </div>
        ) : (
          <p className={styles.readOnlyNote}>
            Автора не прив’язано і речення про курс не написано — блок «Автор» на сторінці не з’явиться.
          </p>
        )}

        {linked && !linked.listed ? (
          <p className={styles.readOnlyNote}>
            Профіль не публічний: ім’я і фото друкуються, але посилання «Про автора» — ні.
          </p>
        ) : null}
      </section>

      <section className={styles.courseSettingSection}>
        <div className={styles.courseSettingCopy}>
          <h3 className={styles.courseSettingTitle}>Чий це профіль</h3>
        </div>
        {data ? (
          <div className={styles.authorLinkActions}>
            {data?.ownAuthor ? (
              !isSelf ? (
                <button className={styles.quietAction} type="button" disabled={busy} onClick={() => void apply("attach-self")}>
                  Прив’язати свій профіль
                </button>
              ) : (
                <p className={styles.readOnlyNote}>Прив’язано ваш профіль автора.</p>
              )
            ) : (
              <p className={styles.readOnlyNote}>
                У вас ще немає профілю автора. <Link href="/profile">Заповніть його в кабінеті</Link> — ім’я, фото і
                біографія звідти підуть на кожен ваш курс.
              </p>
            )}
            {linked ? (
              <button className={styles.quietAction} type="button" disabled={busy} onClick={() => void apply("detach")}>
                Прибрати автора з курсу
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className={styles.courseSettingSection}>
        <div className={styles.courseSettingCopy}>
          <h3 className={styles.courseSettingTitle}>Про цей курс</h3>
        </div>
        <FieldInput
          field={{
            path: ["authorNote"],
            label: "Чому саме ви — про цей курс",
            kind: "text",
            multiline: true,
            hint: "Одне речення. Біографія і фото живуть у профілі автора (вище), тут — тільки те, що змінюється від курсу до курсу.",
          }}
          value={course.authorNote}
          onChange={onChange}
        />
      </section>
    </div>
  );
}
