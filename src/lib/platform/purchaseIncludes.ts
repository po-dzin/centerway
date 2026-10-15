/**
 * What one payment includes, said once for both surfaces that print it: the
 * program page's checkout panel and the checkout page (`checkoutSummary.ts`).
 * Pure, so a client component can import it without pulling in a database
 * client.
 */

import { plural } from "@/lib/plural";
import type { Course } from "@/lms-core";

/**
 * Where the thing you bought actually appears. Everything is delivered on the
 * platform now: since 2026-08-29 no bot issues a course, and the bots are
 * support and conversation only. A course opens in the library; a product with
 * no course behind it (the herbal blend) appears in the cabinet.
 */
export function deliveryLine(hasCourse: boolean, isFree = false): string {
  return hasCourse
    ? isFree
      ? "Курс відкриється у вашому кабінеті одразу після старту"
      : "Курс відкриється у вашому кабінеті одразу після оплати"
    : "Одразу після оплати замовлення зʼявиться у вашому кабінеті на платформі";
}

/**
 * What one payment includes, in the words the program page's panel uses.
 *
 * `duration` is the page's own fallback for an offer with no course behind it
 * («7 днів за структурою автора»); pass null where there is nothing to say.
 */
export function purchaseIncludes({
  course,
  duration,
  isFree = false,
}: {
  course: Course | null;
  duration: string | null;
  isFree?: boolean;
}): string[] {
  const lessonCount = course ? course.modules.reduce((total, module) => total + module.lessons.length, 0) : 0;
  const delivery = deliveryLine(course !== null, isFree);

  /* SENTENCE CASE THROUGHOUT (2026-09-11). These lines are list items, and
     every other list on the page — what the reader gets, who it is for, what it
     is made of — is written by the author in sentence case. */
  return [
    ...(course
      ? [
          `${lessonCount} ${plural(lessonCount, "урок", "уроки", "уроків")} у ${course.modules.length} ${plural(course.modules.length, "модулі", "модулях", "модулях")}`,
        ]
      : duration
        ? [`${duration} за структурою автора`]
        : []),
    delivery,
    isFree ? "Без оплати, підписки й автоплатежів" : "Разова оплата, без підписки і автоплатежів",
    "Проходити можна з телефона і з компʼютера",
  ];
}
