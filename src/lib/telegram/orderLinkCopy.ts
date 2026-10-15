/**
 * What the bot says when a buyer opens it from the order link
 * (`lib/platform/orderTelegramLink.ts`). Pure, so the wording is tested without
 * a chat or a database.
 *
 * Three cases, because the buyer's next date differs: a group stream that has
 * not started (the date is the news), one already running (the lessons are),
 * and a course in the buyer's own pace (no date at all).
 */

import { ukDate } from "@/lib/email/lifecycleEmails";
import { escapeTelegramHtml } from "./tg";

export type OrderLinkedInput = {
  name: string | null;
  programTitle: string;
  /** A group offer's shared start date (YYYY-MM-DD); null for self-paced. */
  cohortStartsOn: string | null;
  /** Today in Kyiv (YYYY-MM-DD) — where the stream's days are counted. */
  today: string;
};

export function orderLinkedHtml(input: OrderLinkedInput): string {
  const name = input.name?.trim();
  const head = name ? `<b>Готово, ${escapeTelegramHtml(name)} ✓</b>` : "<b>Готово ✓</b>";
  const title = `«${escapeTelegramHtml(input.programTitle)}»`;

  if (input.cohortStartsOn && input.cohortStartsOn > input.today) {
    return [
      head,
      "",
      `Ви в групі ${title}. Старт — ${ukDate(input.cohortStartsOn)}.`,
      "Сюди прийдуть нагадування напередодні старту, у день старту і щоранку про урок дня.",
    ].join("\n");
  }
  if (input.cohortStartsOn) {
    return [
      head,
      "",
      `Ви в групі ${title}, потік іде з ${ukDate(input.cohortStartsOn)}. Уроки вже відкриті в кабінеті.`,
      "Щоранку сюди прийде нагадування про урок дня.",
    ].join("\n");
  }
  return [head, "", `${title} уже у вашому кабінеті.`, "Сюди приходитимуть нагадування про уроки."].join("\n");
}
