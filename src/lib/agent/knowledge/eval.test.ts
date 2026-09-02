import { describe, expect, it } from "vitest";

import seed from "../../../../data/agent/question-eval.json";
import { snapshotCourses } from "@/lib/lms/catalog";
import { needsHumanHandoff } from "./boundaries";
import { buildCorpus } from "./corpus";
import { evaluateRetrieval, formatReport, type EvalCase } from "./eval";
import { buildIndex } from "./search";

const index = buildIndex(buildCorpus({ courses: snapshotCourses() }));
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
        ["", formatReport(report, 5), ...report.misses.map((miss) => `  ✗ «${miss.question}» → чекали ${miss.expectedDocId}, отримали ${miss.got.join(", ") || "нічого"}`)].join("\n"),
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
      cases
        .map((testCase) => index.docs.find((doc) => doc.id === testCase.expectedDocId)?.kind)
        .filter(Boolean),
    );
    expect(kinds).toContain("support");
    expect(kinds).toContain("policy");
    expect(kinds).toContain("test");
    expect(kinds).toContain("product");
    expect(kinds).toContain("course");
  });
});
