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
 * tab only holds `authorNote` (the one field that is genuinely PER COURSE).
 * The author who owns the course controls its profile link: they may attach
 * their own profile or remove it. Admin may set the initial/fallback link, but
 * cannot turn the author's course into a read-only relationship.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ToastProvider";
import { authorAvatarCropPosition } from "@/lib/lms/authorPhoto";
import { authorProfileCompletion, type Course } from "@/lms-core";
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
  const toast = useToast();

  const refresh = useCallback(async () => {
    const result = await loadCourseAuthorLink(slug);
    setRead(result.ok ? { slug, data: result.data, failed: false } : { slug, data: null, failed: true });
  }, [slug]);

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

  useEffect(() => {
    const refreshAfterProfile = () => void refresh();
    window.addEventListener("focus", refreshAfterProfile);
    window.addEventListener("pageshow", refreshAfterProfile);
    return () => {
      window.removeEventListener("focus", refreshAfterProfile);
      window.removeEventListener("pageshow", refreshAfterProfile);
    };
  }, [refresh]);

  async function apply(action: "attach-self" | "detach") {
    setBusy(true);
    const result = await setCourseAuthorLink(slug, action);
    setBusy(false);
    if (result.ok) {
      setRead((prev) =>
        prev.data ? { ...prev, data: { ...prev.data, linkedAuthor: result.data.linkedAuthor, linkedAuthorId: result.data.linkedAuthorId } } : prev
      );
      toast.success(action === "attach-self" ? "Профіль прив’язано до курсу" : "Профіль відв’язано від курсу");
    } else toast.error("Не вдалося змінити автора курсу");
  }

  const data = read.slug === slug ? read.data : null;
  const failed = read.slug === slug && read.failed;
  const loading = !data && !failed;
  const linked = data?.linkedAuthor ?? null;
  const isSelf = Boolean(data?.ownAuthor && data?.linkedAuthorId === data?.ownAuthor?.id);
  const completion = linked ? authorProfileCompletion(linked) : null;

  return (
    <div className={styles.settingsForm}>
      {/* THE PREVIEW SITS FIRST, because it is the answer to the tab's own
          question — "who's on the page" — and everything below it is either how
          that got decided or the one line that changes it. */}
      <section className={styles.courseSettingSection}>
        <div className={styles.courseSettingCopy}>
          <h3 className={styles.courseSettingTitle}>Профіль автора</h3>
        </div>

        {loading ? (
          <p className={styles.readOnlyNote}>Завантаження…</p>
        ) : failed ? (
          <p className={styles.readOnlyNote}>Не вдалося прочитати профіль автора. Спробуйте оновити сторінку.</p>
        ) : linked ? (
          <div className={styles.authorPreviewCard}>
            {linked?.photo ? (
              /* THE CROP THE AUTHOR SET, like every other frame that draws
                 this photograph. This preview answers "who is on the page",
                 and it was the one place in the product rendering the picture
                 at its raw centre — so an author who had dragged their avatar
                 frame in the cabinet saw it applied on their own page and on
                 every course page, and undone here. */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className={styles.authorPreviewPhoto}
                src={linked.photo.src}
                alt={linked.photo.alt}
                style={{ objectPosition: authorAvatarCropPosition(linked.photo) }}
              />
            ) : (
              <span className={`${styles.authorPreviewPhoto} ${styles.authorPreviewPhotoEmpty}`} aria-hidden="true">
                <Icon name="user" size={20} />
              </span>
            )}
            <div className={styles.authorPreviewBody}>
              <div className={styles.authorPreviewIdentity}>
                <div>
                  <p className={styles.authorPreviewName}>{linked.name}</p>
                  {linked.role ? <p className={styles.authorPreviewRole}>{linked.role}</p> : null}
                </div>
                {completion ? (
                  <span className={styles.authorCompletion} aria-label={`Профіль заповнено на ${completion.percent} відсотків`}>
                    Профіль {completion.percent}%
                  </span>
                ) : null}
              </div>
              <p className={styles.readOnlyNote}>Ці дані використовуються в усіх ваших курсах.</p>
              <div className={styles.authorLinkActions}>
                {isSelf ? (
                  <Link className={styles.quietAction} href="/profile#author">
                    Редагувати профіль автора
                  </Link>
                ) : null}
                {linked.listed ? (
                  <Link className={styles.authorPreviewCue} href={`/expert/${linked.slug}`} target="_blank" rel="noopener noreferrer">
                    Переглянути профіль <Icon name="arrow-right" size={16} />
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <p className={styles.readOnlyNote}>
            Автора не прив’язано — блок «Автор» на сторінці курсу не з’явиться.
          </p>
        )}

        {linked && !linked.listed ? (
          <p className={styles.readOnlyNote}>
            Профіль не публічний: ім’я і фото друкуються, але посилання «Про автора» — ні.
          </p>
        ) : null}
        {data ? (
          <div className={styles.authorLinkActions}>
            {data.ownAuthor ? (
              !isSelf ? (
                <button className={styles.quietAction} type="button" disabled={busy} onClick={() => void apply("attach-self")}>
                  {linked ? "Показувати мій профіль" : "Прив’язати свій профіль"}
                </button>
              ) : null
            ) : (
              <p className={styles.readOnlyNote}>
                У вас ще немає профілю автора. <Link href="/profile#author">Створіть його в кабінеті</Link>, щоб показувати
                себе автором цього й наступних курсів.
              </p>
            )}
            {isSelf ? (
              <button className={styles.quietAction} type="button" disabled={busy} onClick={() => void apply("detach")}>
                Прибрати автора з курсу
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className={styles.courseSettingSection}>
        {/* NO SUMMARY OVER A SINGLE FIELD. The section held four lines of
            naming for one textarea — heading, summary, label, hint — and the
            summary said where the sentence is printed, which is the field's
            own business. It moved into the hint, where it stands beside the
            example instead of above the question. */}
        <div className={styles.courseSettingCopy}>
          <h3 className={styles.courseSettingTitle}>Про цей курс</h3>
        </div>
        <FieldInput
          field={{
            path: ["authorNote"],
            label: "Чому саме ви створили цей курс",
            kind: "text",
            multiline: true,
            hint: "Наприклад: «Створив цей курс, щоб дати м’який перший крок у практику». Друкується в блоці «Автор» на сторінці саме цього курсу і не повторюється в інших. Біографія, фото й досягнення живуть у профілі автора вище.",
          }}
          value={course.authorNote}
          onChange={onChange}
        />
      </section>
    </div>
  );
}
