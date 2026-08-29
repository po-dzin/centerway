import { describe, expect, it } from "vitest";

import { needsHumanHandoff } from "./boundaries";

/**
 * The guard that does not depend on retrieval finding anything.
 *
 * Both directions are tested, and the second list matters as much as the first:
 * a boundary that catches every question is not a boundary, it is a broken
 * assistant that forwards the catalogue to a human.
 */
describe("health boundary", () => {
  const escalates = [
    "чи можна мені це при захворюванні щитовидки",
    "у мене гіпертонія, чи підходить програма",
    "можно ли мне детокс при беременности",
    "я принимаю лекарства, это совместимо?",
    "чи безпечно мені після операції",
    "is it safe for me with a heart condition",
    // No condition named at all — the question is about the person, and the
    // assistant cannot know what it would be agreeing to.
    "чи можна мені це?",
  ];

  const answers = [
    "скільки коштує Шлях 21",
    "де мій курс після оплати",
    "у мене болить спина після сидячої роботи, який курс підійде",
    "коли відкриється наступний урок",
    "як підключити телеграм до кабінету",
    "чи можна оплатити карткою іншого банку",
  ];

  for (const question of escalates) {
    it(`escalates: ${question}`, () => {
      expect(needsHumanHandoff(question).escalate).toBe(true);
    });
  }

  for (const question of answers) {
    it(`answers itself: ${question}`, () => {
      expect(needsHumanHandoff(question).escalate).toBe(false);
    });
  }

  it("reports what matched, for the log", () => {
    expect(needsHumanHandoff("при діабеті можна?").matched).toContain("діабет");
  });
});
