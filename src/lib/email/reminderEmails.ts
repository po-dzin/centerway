/**
 * The learning reminders, as letters: «урок готовий» (day N of a daily course)
 * and «курс чекає» (bought, never opened).
 *
 * WHY EMAIL AT ALL. These reminders were written for Telegram, and Telegram is
 * linked on a handful of accounts — almost every learner got nothing. The
 * letter is the fallback for exactly those learners; who gets which is decided
 * in `src/lib/lms/reminderEmail.ts`, not here.
 *
 * PURE, like `lifecycleEmails.ts`: no network, no database, no env. The words
 * mirror the Telegram texts in `src/lib/lms/reminders.ts` so a learner hears
 * the same thing whichever channel reaches them — calm, «ви», no promise of a
 * result, no pressure to hurry.
 *
 * DRAFT COPY (2026-10-03): written by an agent from the Telegram texts and the
 * voice doc (docs/platform-copy-voice-2026-09-23.md); not yet read by the owner.
 */

import { compose, greet, type Line } from "./lifecycleEmails";

export type ReminderEmail = { subject: string; preheader: string; html: string; text: string };

/** Answers the question the learner will have on reading it: why email, why me. */
const WHY_EMAIL: Line = {
  text: "Нагадування приходять на пошту, бо до вашого акаунта не підключено Telegram.",
};

function help(supportUrl: string): Line {
  return { link: supportUrl, before: "Якщо щось не відкривається — ", label: "напишіть нам", after: "." };
}

function withPreheader(preheader: string, letter: { subject: string; html: string; text: string }): ReminderEmail {
  return { ...letter, preheader };
}

/** Day N of a daily course: today's lesson is open. */
export function buildLessonReminderEmail(input: {
  name?: string | null;
  courseTitle: string;
  lessonTitle: string;
  dayNumber: number;
  lessonUrl: string;
  supportUrl: string;
}): ReminderEmail {
  const { courseTitle, lessonTitle, dayNumber } = input;
  const preheader = `«${lessonTitle}» — урок готовий. Заходьте, коли буде зручно.`;
  return withPreheader(
    preheader,
    compose({
      subject: `День ${dayNumber} · ${courseTitle}`,
      preheader,
      eyebrow: `День ${dayNumber} · ${courseTitle}`,
      title: "Урок дня готовий",
      greeting: greet(input.name),
      paragraphs: [
        { text: `У програмі «${courseTitle}» відкрився урок «${lessonTitle}».` },
        { text: "Заходьте, коли буде зручно, і рухайтеся у своєму темпі. Прогрес зберігається в кабінеті." },
      ],
      cta: { label: "Відкрити урок", href: input.lessonUrl },
      foot: [help(input.supportUrl), WHY_EMAIL],
    }),
  );
}

/**
 * Bought and never opened. Nudge 1 says where the course is; every later nudge
 * adds the one fact that takes the worry out of starting late — the days count
 * from the first opening (the same sentence the Telegram nudge carries).
 */
export function buildUnstartedReminderEmail(input: {
  name?: string | null;
  courseTitle: string;
  nudgeNumber: number;
  courseUrl: string;
  supportUrl: string;
}): ReminderEmail {
  const { courseTitle } = input;
  const first = input.nudgeNumber === 1;
  const preheader = first
    ? "Перший урок можна пройти тоді, коли буде зручно."
    : "Відлік днів починається з першого відкриття, тож ви нічого не пропустили.";
  return withPreheader(
    preheader,
    compose({
      subject: first ? `«${courseTitle}» вже у вашому кабінеті` : `Нагадуємо: «${courseTitle}» чекає в кабінеті`,
      preheader,
      eyebrow: courseTitle,
      title: first ? "Курс уже відкритий" : "Курс чекає на вас",
      greeting: greet(input.name),
      paragraphs: first
        ? [
            { text: `«${courseTitle}» вже відкритий у вашому кабінеті.` },
            { text: "Перший урок можна пройти тоді, коли буде зручно." },
          ]
        : [
            { text: `Нагадуємо: «${courseTitle}» чекає у вашому кабінеті.` },
            {
              text: "Відлік днів починається з першого відкриття, тож ви нічого не пропустили. Почніть тоді, коли буде зручно.",
            },
          ],
      cta: { label: "Почати курс", href: input.courseUrl },
      foot: [help(input.supportUrl), WHY_EMAIL],
    }),
  );
}
