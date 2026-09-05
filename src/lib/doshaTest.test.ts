import { describe, expect, it } from "vitest";
import {
  DOSHA_RESULT_TYPES,
  DOSHA_TEST_QUESTIONS,
  calculateDoshaResult,
  classifyDosha,
  presentQuestionsForSession,
  type DoshaResultType,
} from "./doshaTest";

const TOTAL = DOSHA_TEST_QUESTIONS.length;

function allCompositions(): Array<[number, number, number]> {
  const rows: Array<[number, number, number]> = [];
  for (let v = 0; v <= TOTAL; v += 1) {
    for (let p = 0; p <= TOTAL - v; p += 1) {
      rows.push([v, p, TOTAL - v - p]);
    }
  }
  return rows;
}

describe("classifyDosha", () => {
  it.each([
    // A leader that owns more than 65 % of its pair is a single dosha.
    { v: 12, p: 0, k: 0, type: "vata" },
    { v: 9, p: 2, k: 1, type: "vata" },
    { v: 8, p: 4, k: 0, type: "vata" },
    { v: 3, p: 6, k: 3, type: "pitta" },
    { v: 3, p: 3, k: 6, type: "kapha" },
    // Flatter than 65/35 and not flat overall: a pair.
    { v: 7, p: 4, k: 1, type: "vata_pitta" },
    { v: 6, p: 5, k: 1, type: "vata_pitta" },
    { v: 7, p: 5, k: 0, type: "vata_pitta" },
    { v: 5, p: 5, k: 2, type: "vata_pitta" },
    { v: 6, p: 6, k: 0, type: "vata_pitta" },
    { v: 2, p: 5, k: 5, type: "pitta_kapha" },
    { v: 5, p: 2, k: 5, type: "vata_kapha" },
    // Leader within a sixth of the scale of the weakest dosha: flat.
    { v: 4, p: 4, k: 4, type: "tridosha" },
    { v: 5, p: 4, k: 3, type: "tridosha" },
    { v: 3, p: 5, k: 4, type: "tridosha" },
  ])("reads $v/$p/$k as $type", ({ v, p, k, type }) => {
    expect(calculateDoshaResult(v, p, k)).toBe(type);
  });

  it("keeps a leader single when both runners-up are tied, since no pair is defined", () => {
    expect(calculateDoshaResult(6, 3, 3)).toBe("vata");
    expect(calculateDoshaResult(2, 8, 2)).toBe("pitta");
  });

  it("reaches every declared result type on the 12-question grid", () => {
    const reached = new Set<DoshaResultType>(
      allCompositions().map(([v, p, k]) => calculateDoshaResult(v, p, k))
    );
    expect([...DOSHA_RESULT_TYPES].filter((type) => !reached.has(type))).toEqual([]);
  });

  it("gives no result type a share of the grid below 5 %", () => {
    const counts = new Map<DoshaResultType, number>();
    const grid = allCompositions();
    for (const [v, p, k] of grid) {
      const type = calculateDoshaResult(v, p, k);
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    for (const type of DOSHA_RESULT_TYPES) {
      const share = (counts.get(type) ?? 0) / grid.length;
      expect(share, `${type} covers ${(share * 100).toFixed(1)} % of the grid`).toBeGreaterThan(0.05);
    }
  });

  it("never softens the verdict when the leader gains at the expense of the runner-up", () => {
    // Moving one answer from second place to first can turn tridosha into a
    // pair and a pair into a single dosha, but never the other way round.
    const rank: Record<string, number> = { tridosha: 0, dual: 1, single: 2 };
    const shape = (type: DoshaResultType) =>
      type === "tridosha" ? rank.tridosha : type.includes("_") ? rank.dual : rank.single;

    for (let lead = 0; lead <= TOTAL; lead += 1) {
      for (let second = 0; second + lead <= TOTAL; second += 1) {
        const third = TOTAL - lead - second;
        if (second < 1 || lead < second || second < third) continue;
        const before = shape(calculateDoshaResult(lead, second, third));
        const after = shape(calculateDoshaResult(lead + 1, second - 1, third));
        expect(after, `${lead}/${second}/${third} → ${lead + 1}/${second - 1}/${third}`)
          .toBeGreaterThanOrEqual(before);
      }
    }
  });

  it("reports shares, not just counts", () => {
    const result = classifyDosha(6, 3, 3);
    expect(result.shares).toEqual({ vata: 50, pitta: 25, kapha: 25 });
    expect(result.spreadPp).toBe(25);
  });

  it.each([
    { v: 12, p: 0, k: 0, confidence: "high" },
    { v: 4, p: 4, k: 4, confidence: "high" },
    { v: 6, p: 5, k: 1, confidence: "high" },
    { v: 5, p: 5, k: 2, confidence: "medium" },
    { v: 7, p: 5, k: 0, confidence: "medium" },
    // One answer from being a pair instead of a single dosha.
    { v: 8, p: 4, k: 0, confidence: "low" },
    // One answer from being a single dosha instead of a pair.
    { v: 7, p: 4, k: 1, confidence: "low" },
    // On the tridosha line itself.
    { v: 5, p: 4, k: 3, confidence: "low" },
  ])("rates $v/$p/$k as $confidence confidence", ({ v, p, k, confidence }) => {
    expect(classifyDosha(v, p, k).confidence).toBe(confidence);
  });

  it("survives an empty score triple", () => {
    expect(classifyDosha(0, 0, 0)).toMatchObject({ type: "tridosha", confidence: "low" });
  });
});

describe("presentQuestionsForSession", () => {
  const source = DOSHA_TEST_QUESTIONS.map((question, index) => ({
    id: `question-${index}`,
    orderIndex: question.order,
    code: question.code,
    text: question.text,
    options: question.options.map((option) => ({
      id: `${option.code}-id`,
      order: option.order,
      code: option.code,
      text: option.text,
      mappedDosha: option.mappedDosha,
    })),
  }));

  it("never ships the answer key to the browser", () => {
    const presented = presentQuestionsForSession(source, "session-a");
    for (const question of presented) {
      for (const option of question.options) {
        expect(option).not.toHaveProperty("mappedDosha");
      }
    }
  });

  it("keeps every option, and the questions in their own order", () => {
    const presented = presentQuestionsForSession(source, "session-a");
    expect(presented.map((q) => q.code)).toEqual(source.map((q) => q.code));
    for (const [index, question] of presented.entries()) {
      expect([...question.options].map((o) => o.id).sort()).toEqual(
        source[index].options.map((o) => o.id).sort()
      );
      // The order field is the position on screen, not the seed order.
      expect(question.options.map((o) => o.order)).toEqual([1, 2, 3]);
    }
  });

  it("gives one session the same order every time it asks", () => {
    const first = presentQuestionsForSession(source, "session-a");
    const second = presentQuestionsForSession(source, "session-a");
    expect(second).toEqual(first);
  });

  it("stops vata from always sitting under the thumb", () => {
    // The seed order put vata first in all twelve questions, for everyone.
    // Across sessions, first place has to be spread over all three doshas.
    const keyByOptionId = new Map(
      source.flatMap((q) => q.options.map((o) => [o.id, o.mappedDosha] as const))
    );
    const firstPlace: Record<string, number> = { vata: 0, pitta: 0, kapha: 0 };

    for (let i = 0; i < 200; i += 1) {
      for (const question of presentQuestionsForSession(source, `session-${i}`)) {
        const dosha = keyByOptionId.get(question.options[0].id)!;
        firstPlace[dosha] += 1;
      }
    }

    const total = Object.values(firstPlace).reduce((a, b) => a + b, 0);
    for (const dosha of ["vata", "pitta", "kapha"]) {
      const share = firstPlace[dosha] / total;
      expect(share, `${dosha} leads ${(share * 100).toFixed(1)} % of questions`).toBeGreaterThan(0.28);
      expect(share).toBeLessThan(0.39);
    }
  });
});

describe("buildDoshaResultMessage", () => {
  it("says the same thing the screen says, at the same strength", async () => {
    const { buildDoshaResultMessage, RESULT_COPY } = await import("./doshaResultCopy");

    const firm = buildDoshaResultMessage({
      resultType: "vata",
      scores: { vata: 9, pitta: 2, kapha: 1 },
      intro: "Ваш результат:",
      outro: "Кінець.",
      nextHref: "https://example.com/consult",
    });
    expect(firm).toContain(RESULT_COPY.vata.title);
    expect(firm).toContain("Вата 75% • Пітта 16.7% • Капха 8.3%");
    expect(firm).toContain("https://example.com/consult");

    // One answer from being a pair: the chat must not assert what the screen
    // hedges.
    const shaky = buildDoshaResultMessage({
      resultType: "vata",
      scores: { vata: 8, pitta: 4, kapha: 0 },
      intro: "Ваш результат:",
      outro: "Кінець.",
    });
    expect(shaky).toContain(RESULT_COPY.vata.softTitle);
    expect(shaky).not.toContain(RESULT_COPY.vata.title);
  });
});
