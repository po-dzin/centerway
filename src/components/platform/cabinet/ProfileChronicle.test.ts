import { describe, expect, it } from "vitest";

import type { LearnerShelfCourseDto } from "@/components/lms/lmsClient";

import { chronicleEvents } from "./ProfileChronicle";

const course = (over: Partial<LearnerShelfCourseDto>): LearnerShelfCourseDto =>
  ({
    slug: "c",
    title: "Осінній цикл",
    startedAt: null,
    lastActivityAt: null,
    currentLessonTitle: null,
    ...over,
  }) as LearnerShelfCourseDto;

describe("profile chronicle", () => {
  it("lists what happened, newest first, from real data only", () => {
    const events = chronicleEvents({
      lang: "uk",
      courses: [
        course({
          startedAt: "2026-10-01T10:00:00Z",
          lastActivityAt: "2026-10-20T10:00:00Z",
          currentLessonTitle: "Дихання",
        }),
      ],
      purchases: [
        {
          orderRef: "o",
          offerCode: "x",
          offerKind: "program",
          title: "Шлях 21",
          amount: 1,
          currency: "UAH",
          createdAt: "2026-09-30T10:00:00Z",
        },
      ],
      dosha: {
        attemptId: "a",
        testId: "t",
        testSlug: "dosha",
        resultType: "vata",
        version: 1,
        completedAt: "2026-10-05T10:00:00Z",
        scores: { vata: 1, pitta: 1, kapha: 1 },
      },
      balance: null,
    });
    expect(events.map((event) => event.text)).toEqual([
      "Урок «Дихання» · Осінній цикл",
      "Тест доші: Вата",
      "Почали «Осінній цикл»",
      "Покупка: Шлях 21",
    ]);
  });

  it("has nothing to say when nothing happened", () => {
    expect(chronicleEvents({ lang: "uk", courses: [course({})], purchases: [], dosha: null, balance: null })).toEqual(
      [],
    );
  });
});
