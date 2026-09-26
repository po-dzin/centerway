import { describe, expect, it } from "vitest";

import seed from "../../../../data/agent/question-eval.json";
import { snapshotCourses } from "@/lib/lms/catalog";
import { needsHumanHandoff } from "./boundaries";
import { buildCorpus, type CorpusOffer } from "./corpus";
import { evaluateRetrieval, formatReport, type EvalCase } from "./eval";
import { buildIndex } from "./search";

/* The offers the server reads from `experience_offers`, as a fixture shaped
   like production's (their invoice prose, 2026-09-26): the labelled price
   question needs a price document to find, and retrieval is scored against a
   corpus of the size people actually query. */
const offers: CorpusOffer[] = [
  {
    code: "course:short",
    heading: "Short Reboot — онлайн-курс",
    description:
      'Оплата онлайн-курсу "Short Reboot" від CenterWay. Після успішної оплати курс відкриється у вашому кабінеті на платформі - там уроки, матеріали і подальші кроки. Підтримка: якщо виникли питання - напишіть нам, допоможемо.',
    mode: "checkout",
    amount: 795,
    currency: "UAH",
    delivery: "course",
    href: "/programs/reboot",
  },
  {
    code: "course:irem-gymnastics",
    heading: "ІВЕМ-гімнастика — онлайн-система",
    description:
      'Оплата онлайн-системи "ІВЕМ-гімнастика" від CenterWay. Після успішної оплати система відкриється у вашому кабінеті на платформі - там уроки, розбори вправ і подальші кроки. Підтримка: якщо виникли питання - напишіть нам, допоможемо.',
    mode: "checkout",
    amount: 3950,
    currency: "UAH",
    delivery: "course",
    href: "/programs/irem",
  },
  {
    code: "course:way21",
    heading: "Шлях 21 — інтегративна детокс-програма",
    description:
      'Оплата детокс-програми "Шлях 21" від CenterWay. Після успішної оплати програма відкриється у вашому кабінеті на платформі - там уроки, матеріали і подальші кроки. Підтримка: якщо виникли питання - напишіть нам, допоможемо.',
    mode: "checkout",
    amount: 4100,
    currency: "UAH",
    delivery: "course",
    href: "/programs/way21",
  },
  {
    code: "way21-support",
    heading: "Шлях 21 — індивідуальний супровід",
    description:
      'Оплата пакета "Шлях 21 — індивідуальний супровід" від CenterWay: програма детоксу з 2 особистими консультаціями та персональним веденням. Після оплати програма відкриється у вашому кабінеті на платформі, а час консультацій узгодимо з вами особисто. Підтримка: якщо виникли питання - напишіть нам, допоможемо.',
    mode: "lead",
    amount: 9000,
    currency: "UAH",
    delivery: "course",
    href: "/programs/way21",
  },
  {
    code: "course:reset-day",
    heading: "Розвантажувальний день — міні-курс",
    description:
      'Оплата міні-курсу "Розвантажувальний день" від CenterWay. Після успішної оплати міні-курс відкриється у вашому кабінеті на платформі - там уроки, матеріали і подальші кроки. Підтримка: якщо виникли питання - напишіть нам, допоможемо.',
    mode: "checkout",
    amount: 690,
    currency: "UAH",
    delivery: "course",
    href: "/programs/reset-day",
  },
  {
    code: "herbs",
    heading: "Фітозбір — індивідуальний підбір",
    description:
      "Оплата індивідуального підбору фітозбору від CenterWay. Після успішної оплати відкриється сторінка підтвердження та кнопка переходу до продукту в кабінеті — там же будуть подальші інструкції. Підтримка: якщо виникли питання - напишіть нам, допоможемо.",
    mode: "lead",
    amount: null,
    currency: "UAH",
    delivery: "cabinet",
    href: null,
  },
];
const index = buildIndex(buildCorpus({ courses: snapshotCourses(), offers }));
const cases = seed.cases as EvalCase[];
const boundaryCases = seed.boundaryCases as { question: string; mustEscalate: boolean }[];

/**
 * The gate the knowledge base is held to.
 *
 * It runs on the labelled questions in the repo — hand-written at the start,
 * because there were no captured ones yet — and it is the same function the
 * `agent:eval` script runs over the questions people actually asked, once those
 * are labelled. A regression here means either the corpus lost a document or
 * somebody changed its words to something nobody uses.
 */
describe("retrieval over the labelled questions", () => {
  const report = evaluateRetrieval(index, cases, { k: 5 });

  it("finds the right document for every labelled question", () => {
    // Printed rather than merely asserted: when this fails, the useful output
    // is WHICH question and what came back instead, not "expected 1 to be 0.9".
    if (report.misses.length) {
      console.error(
        [
          "",
          formatReport(report, 5),
          ...report.misses.map(
            (miss) =>
              `  ✗ «${miss.question}» → чекали ${miss.expectedDocId}, отримали ${miss.got.join(", ") || "нічого"}`,
          ),
        ].join("\n"),
      );
    }
    expect(report.misses).toEqual([]);
  });

  it("has no stale labels pointing at documents the corpus dropped", () => {
    expect(report.unknownExpectations).toEqual([]);
  });

  /**
   * Health questions are measured HERE, against the rule, and are deliberately
   * absent from the retrieval cases above.
   *
   * The reason is a measurement, not a preference: «у мене гіпертонія, чи
   * підходить програма» retrieves the course, not the boundary document,
   * because the word «гіпертонія» is not in that document — and will not be,
   * however many diagnoses get appended to it. Retrieval is the wrong
   * mechanism for this question; the stem lexicon that runs before it is the
   * right one.
   */
  it("routes every health question to a person, and no ordinary one", () => {
    for (const testCase of boundaryCases) {
      expect(needsHumanHandoff(testCase.question).escalate, testCase.question).toBe(testCase.mustEscalate);
    }
  });

  it("covers every kind of document the corpus holds", () => {
    // A measurement that only exercises support answers would go green while
    // course and product retrieval rotted.
    const kinds = new Set(
      cases.map((testCase) => index.docs.find((doc) => doc.id === testCase.expectedDocId)?.kind).filter(Boolean),
    );
    expect(kinds).toContain("support");
    expect(kinds).toContain("policy");
    expect(kinds).toContain("test");
    expect(kinds).toContain("product");
    expect(kinds).toContain("course");
  });
});
