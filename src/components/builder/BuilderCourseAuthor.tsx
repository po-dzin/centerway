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
 *
 * DISPLACING SOMEONE ELSE'S BYLINE IS A QUESTION, NOT A BUTTON. «Показувати
 * мій профіль» on a course that already prints another person reads as "add
 * me" and does "replace them" — and for an admin, who can open every course,
 * that is one stray click away on any course in the product. So the move is
 * confirmed in a `BuilderDecision` that names the person being taken off the
 * page, and an admin is offered the way back (the roster below) in the same
 * breath — until `attach-profile` existed there wasn't one.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ToastProvider";
import { authorProfileCompletion, type Course } from "@/lms-core";
import {
  loadCourseAuthorLink,
  setCourseAuthorLink,
  type CourseAuthorLinkDto,
  type CourseAuthorLinkMove,
} from "./builderClient";
import { BuilderDecision } from "./BuilderDecision";
import { FieldInput } from "./BuilderFields";
import { AuthorPortrait } from "@/components/platform/AuthorPortrait";
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
  /** The move waiting on an answer, with the name it would take off the page. */
  const [pending, setPending] = useState<{ move: CourseAuthorLinkMove; displaced: string } | null>(null);
  const [picked, setPicked] = useState("");
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

  async function apply(move: CourseAuthorLinkMove) {
    setBusy(true);
    const result = await setCourseAuthorLink(slug, move);
    setBusy(false);
    setPending(null);
    if (result.ok) {
      setRead((prev) =>
        prev.data
          ? {
              ...prev,
              data: {
                ...prev.data,
                linkedAuthor: result.data.linkedAuthor,
                linkedAuthorId: result.data.linkedAuthorId,
              },
            }
          : prev,
      );
      setPicked("");
      toast.success(move.action === "detach" ? "Профіль відв’язано від курсу" : "Профіль прив’язано до курсу");
    } else toast.error("Не вдалося змінити автора курсу");
  }

  /**
   * Every write goes through here. A move that replaces a byline belonging to
   * somebody other than the caller stops for an answer first; anything else —
   * filling an empty byline, attaching or removing your own — goes straight
   * through, because there is nobody to displace.
   */
  function request(move: CourseAuthorLinkMove, displaced: string | null) {
    if (displaced) setPending({ move, displaced });
    else void apply(move);
  }

  const data = read.slug === slug ? read.data : null;
  const failed = read.slug === slug && read.failed;
  const loading = !data && !failed;
  const linked = data?.linkedAuthor ?? null;
  const isSelf = Boolean(data?.ownAuthor && data?.linkedAuthorId === data?.ownAuthor?.id);
  const completion = linked ? authorProfileCompletion(linked) : null;
  /* Someone else's name is on the page — the only state in which a change here
     takes something away from a person who is not the one clicking. */
  const displaced = linked && !isSelf ? linked.name : null;
  const roster = (data?.mayAssign ? (data.assignableAuthors ?? []) : []).filter(
    (author) => author.id !== data?.linkedAuthorId,
  );

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
              <AuthorPortrait photo={linked.photo} size="sm" />
            ) : (
              <AuthorPortrait photo={null} size="sm" fallback={<Icon name="user" size={20} />} />
            )}
            <div className={styles.authorPreviewBody}>
              <div className={styles.authorPreviewIdentity}>
                <div>
                  <p className={styles.authorPreviewName}>{linked.name}</p>
                  {linked.role ? <p className={styles.authorPreviewRole}>{linked.role}</p> : null}
                </div>
                {completion ? (
                  <span
                    className={styles.authorCompletion}
                    aria-label={`Профіль заповнено на ${completion.percent} відсотків`}
                  >
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
                  <Link
                    className={styles.authorPreviewCue}
                    href={`/expert/${linked.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Переглянути профіль <Icon name="arrow-right" size={16} />
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <p className={styles.readOnlyNote}>Автора не прив’язано — блок «Автор» на сторінці курсу не з’явиться.</p>
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
                <button
                  className={styles.quietAction}
                  type="button"
                  disabled={busy}
                  onClick={() => request({ action: "attach-self" }, displaced)}
                >
                  {linked ? "Показувати мій профіль" : "Прив’язати свій профіль"}
                </button>
              ) : null
            ) : (
              <p className={styles.readOnlyNote}>
                У вас ще немає профілю автора. <Link href="/profile#author">Створіть його в кабінеті</Link>, щоб
                показувати себе автором цього й наступних курсів.
              </p>
            )}
            {isSelf ? (
              <button
                className={styles.quietAction}
                type="button"
                disabled={busy}
                onClick={() => request({ action: "detach" }, null)}
              >
                Прибрати автора з курсу
              </button>
            ) : null}
          </div>
        ) : null}

        {/* THE WAY BACK. Only an admin sees it, because only an admin may send
            the byline to a profile that is not their own — and only they can
            reach a course whose author they are not, which is the situation
            that needs undoing. */}
        {roster.length > 0 ? (
          <div className={styles.authorLinkActions}>
            <label className={styles.readOnlyNote} htmlFor="course-author-assign">
              Передати авторство іншому профілю
            </label>
            <select
              className={styles.input}
              id="course-author-assign"
              value={picked}
              disabled={busy}
              onChange={(event) => setPicked(event.target.value)}
            >
              <option value="">Оберіть автора…</option>
              {roster.map((author) => (
                <option key={author.id} value={author.id}>
                  {author.name}
                  {author.listed ? "" : " (профіль не публічний)"}
                </option>
              ))}
            </select>
            <button
              className={styles.quietAction}
              type="button"
              disabled={busy || !picked}
              onClick={() => request({ action: "attach-profile", authorProfileId: picked }, displaced)}
            >
              Призначити автором
            </button>
          </div>
        ) : null}
      </section>

      <BuilderDecision
        open={pending !== null}
        title="Замінити автора курсу?"
        onDismiss={() => setPending(null)}
        actions={
          <>
            <button
              className={styles.dangerAction}
              type="button"
              disabled={busy}
              onClick={() => pending && void apply(pending.move)}
            >
              {busy ? "Змінюємо…" : "Замінити"}
            </button>
            <button className={styles.quietAction} type="button" disabled={busy} onClick={() => setPending(null)}>
              Скасувати
            </button>
          </>
        }
      >
        <p className={styles.panelText}>
          Зараз на сторінці курсу стоїть {pending?.displaced}. Після заміни ім’я, фото й посилання на профіль
          зміняться всюди, де показується цей курс.
        </p>
        <p className={styles.readOnlyNote}>
          {data?.mayAssign
            ? "Повернути попереднього автора можна тут же — через «Передати авторство іншому профілю»."
            : "Повернути попереднього автора самостійно ви не зможете: це робить адміністратор."}
        </p>
      </BuilderDecision>

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
