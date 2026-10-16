"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { useToast } from "@/components/ToastProvider";
import { plural } from "@/lib/plural";
import { getCourseAnnouncements, sendCourseAnnouncement, type CourseAnnouncementsView } from "./builderClient";
import styles from "./Builder.module.css";

/**
 * «Оголошення» — the author's one-way note to everyone in the course (L1).
 *
 * SEMANTIC PREFLIGHT (2026-10-15; RAverse canon not read — unreachable from the
 * cloud session, docs/CANON.md and docs/platform_agent_preflight.md used).
 * - semantic_role: зв'язок (primary) — a form and its history, density Compact.
 * - user_question: «Як сказати своїм учням одне важливе, і чи воно дійшло?»
 * - token_source: global DS through `Builder.module.css` — panel, field,
 *   textarea, select, headPrimaryAction, overview list notes. No new palette,
 *   radius, shadow or type scale.
 * - content_source: /api/lms/authoring/courses/:slug/announcements — counts of
 *   recipients, Telegram deliveries and course visits. No learner identity.
 * - route_boundary: the course workspace on the personal host (`#course-
 *   announcements`); the learner course page reads the same rows.
 * - selection_family: the send button is the shared primary. Boundary role:
 *   structural for the panels, none for the history rows.
 *
 * Mockup approved by G on 2026-10-15: https://claude.ai/artifact/QUbXwp4eS53Enz9zYyDE8X
 */

const MAX = 1000;

const ERRORS: Record<string, string> = {
  lms_announcement_body_invalid: "Напишіть текст оголошення, до 1000 знаків.",
  lms_announcement_lesson_unknown: "Цього уроку вже немає в опублікованому курсі. Оберіть інший.",
  lms_announcement_too_soon: "Сьогодні оголошення вже було. Наступне можна надіслати завтра.",
  lms_announcement_no_audience: "У курсі поки немає учнів з відкритим доступом.",
};

const learners = (count: number) => `${count} ${plural(count, "учень", "учні", "учнів")}`;
const when = (iso: string) =>
  new Date(iso).toLocaleString("uk-UA", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export function BuilderAnnouncements({ slug, published }: { slug: string; published: boolean }) {
  const toast = useToast();
  const [view, setView] = useState<CourseAnnouncementsView | null>(null);
  const [failed, setFailed] = useState(false);
  const [body, setBody] = useState("");
  const [lessonSlug, setLessonSlug] = useState("");
  const [busy, setBusy] = useState(false);

  const [revision, setRevision] = useState(0);
  const load = useCallback(() => setRevision((current) => current + 1), []);

  useEffect(() => {
    if (!published) return;
    let cancelled = false;
    void (async () => {
      const result = await getCourseAnnouncements(slug);
      if (cancelled) return;
      if (result.ok) {
        setView(result.data);
        setFailed(false);
      } else {
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, published, revision]);

  if (!published) {
    return (
      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Оголошення з&apos;являться після публікації</h2>
        <p className={styles.panelText}>Писати учням можна, коли курс опубліковано і в ньому є хоча б один учень.</p>
      </section>
    );
  }

  if (failed) {
    return (
      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Не вдалося завантажити оголошення</h2>
        <p className={styles.panelText}>Оновіть сторінку. Якщо не допоможе, напишіть у підтримку.</p>
      </section>
    );
  }

  if (!view) {
    return (
      <section className={styles.panel}>
        <p className={styles.panelText}>Рахуємо учнів курсу…</p>
      </section>
    );
  }

  const { reach } = view;
  const blockedUntil = view.nextAt ? when(view.nextAt) : null;
  const canSend = !busy && !blockedUntil && reach.recipients > 0 && body.trim().length > 0 && body.length <= MAX;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSend) return;
    setBusy(true);
    const result = await sendCourseAnnouncement(slug, { body: body.trim(), lessonSlug: lessonSlug || null });
    setBusy(false);
    if (!result.ok) {
      toast.error((result.detail && ERRORS[result.detail]) ?? "Не вдалося надіслати. Спробуйте ще раз.");
      load();
      return;
    }
    toast.success(`Надіслано: ${learners(result.data.recipients)}.`);
    setBody("");
    setLessonSlug("");
    load();
  }

  return (
    <div className={styles.overviewSections}>
      <section className={styles.panel}>
        <div className={styles.overviewSectionHead}>
          <h2 className={styles.panelTitle}>Нове оголошення</h2>
        </div>
        <form className={styles.overviewSections} onSubmit={(event) => void submit(event)}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Що хочете сказати учням</span>
            <textarea
              id="course-announcement-body"
              className={styles.textarea}
              rows={6}
              maxLength={MAX}
              value={body}
              placeholder="Завтра о 19:00 живий ефір: розберемо ваші питання про ранкову практику."
              onChange={(event) => setBody(event.target.value)}
            />
            <span className={styles.fieldHint}>
              {body.length} / {MAX}
            </span>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Кнопка веде на</span>
            <select
              id="course-announcement-lesson"
              className={`${styles.input} ${styles.select}`}
              value={lessonSlug}
              onChange={(event) => setLessonSlug(event.target.value)}
            >
              <option value="">Сторінку курсу</option>
              {view.lessons.map((lesson) => (
                <option key={lesson.slug} value={lesson.slug}>
                  {lesson.title}
                </option>
              ))}
            </select>
          </label>
          <p className={styles.overviewSectionLead}>
            Отримають {learners(reach.recipients)}. У Telegram прийде {reach.telegram}, решта{" "}
            {Math.max(0, reach.recipients - reach.telegram)} побачать його в курсі. Ви не бачите імен і контактів учнів,
            лише скільки отримали. Відповідати на оголошення не можна.
          </p>
          <div>
            <button type="submit" className={styles.headPrimaryAction} disabled={!canSend}>
              {busy ? "Надсилаємо…" : `Надіслати ${learners(reach.recipients)}`}
            </button>
          </div>
          <p className={styles.fieldHint}>
            {blockedUntil ? `Наступне оголошення можна надіслати ${blockedUntil}.` : "Одне оголошення на курс на добу."}
          </p>
        </form>
      </section>

      <section className={styles.panel}>
        <div className={styles.overviewSectionHead}>
          <h2 className={styles.panelTitle}>Надіслані</h2>
        </div>
        {view.announcements.length === 0 ? (
          <p className={styles.panelText}>Ви ще не писали учням цього курсу.</p>
        ) : (
          <div className={styles.overviewSections} role="list">
            {view.announcements.map((entry) => (
              <div key={entry.id} className={styles.field} role="listitem">
                <span className={styles.fieldLabel}>{when(entry.createdAt)}</span>
                <span className={styles.panelText}>{entry.body}</span>
                <span className={styles.fieldHint}>
                  {entry.telegram} з {entry.recipients} у Telegram · {entry.read} відкрили курс
                  {entry.pending > 0 ? ` · ще надсилаємо ${entry.pending}` : ""}
                  {entry.lessonTitle ? ` · кнопка: ${entry.lessonTitle}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
