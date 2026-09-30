import { describe, expect, it } from "vitest";
import {
  BALANCE_QUESTIONS,
  BALANCE_RESULT_COPY,
  BALANCE_TYPES,
  orderOptionsForAttempt,
  readBalance,
  scoreBalanceAnswers,
  type BalanceType,
} from "@/lib/balance/balanceTest";
import { balanceConsultHref } from "@/lib/balance/balanceRouting";

const repeat = (type: BalanceType, count: number): BalanceType[] => Array.from({ length: count }, () => type);

describe("balance test instrument", () => {
  it("has nine questions, each with exactly one answer per reading", () => {
    expect(BALANCE_QUESTIONS).toHaveLength(9);
    for (const question of BALANCE_QUESTIONS) {
      expect(question.options.map((option) => option.type).sort()).toEqual([...BALANCE_TYPES].sort());
    }
    const codes = BALANCE_QUESTIONS.flatMap((question) => [question.code, ...question.options.map((o) => o.code)]);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("has result copy for every reading", () => {
    for (const type of BALANCE_TYPES) {
      expect(BALANCE_RESULT_COPY[type].practices.length).toBeGreaterThan(0);
    }
  });

  it("speaks «ви», not «ти»", () => {
    const text = JSON.stringify([BALANCE_QUESTIONS, BALANCE_RESULT_COPY]);
    expect(text).not.toMatch(/(^|[^\p{L}])(ти|тебе|тобі|твій|твоя|твоє|твої|твого)(?![\p{L}])/iu);
  });
});

describe("readBalance", () => {
  it("names the largest count", () => {
    const reading = readBalance(scoreBalanceAnswers([...repeat("pitta", 5), ...repeat("balance", 4)]));
    expect(reading.primary).toBe("pitta");
    expect(reading.secondary).toBeNull();
  });

  it("lets an imbalance win a tie with balance", () => {
    const reading = readBalance(scoreBalanceAnswers([...repeat("balance", 4), ...repeat("kapha", 4), "vata"]));
    expect(reading.primary).toBe("kapha");
  });

  it("breaks a tie between doshas vata, then pitta, then kapha", () => {
    expect(readBalance(scoreBalanceAnswers([...repeat("kapha", 4), ...repeat("vata", 4), "pitta"])).primary).toBe(
      "vata",
    );
    expect(readBalance(scoreBalanceAnswers([...repeat("kapha", 4), ...repeat("pitta", 4), "vata"])).primary).toBe(
      "pitta",
    );
  });

  it("names a second dosha once it holds a third of the answers", () => {
    const reading = readBalance(
      scoreBalanceAnswers([...repeat("vata", 4), ...repeat("kapha", 3), ...repeat("balance", 2)]),
    );
    expect(reading.primary).toBe("vata");
    expect(reading.secondary).toBe("kapha");
  });

  it("keeps a dosha loud enough to name even when balance leads", () => {
    const reading = readBalance(scoreBalanceAnswers([...repeat("balance", 6), ...repeat("pitta", 3)]));
    expect(reading.primary).toBe("balance");
    expect(reading.secondary).toBe("pitta");
  });

  it("never names balance as the second signal", () => {
    const reading = readBalance(scoreBalanceAnswers([...repeat("vata", 5), ...repeat("balance", 4)]));
    expect(reading.secondary).toBeNull();
  });
});

describe("orderOptionsForAttempt", () => {
  const question = BALANCE_QUESTIONS[0]!;

  it("is stable for one attempt", () => {
    expect(orderOptionsForAttempt(question, "seed-a")).toEqual(orderOptionsForAttempt(question, "seed-a"));
  });

  it("does not always put balance first", () => {
    const firsts = new Set(
      Array.from({ length: 40 }, (_, i) => orderOptionsForAttempt(question, `seed-${i}`)[0]?.type),
    );
    expect(firsts.size).toBeGreaterThan(1);
  });
});

describe("balanceConsultHref", () => {
  it("carries the reading as utm_content and never as a dosha", () => {
    const query = new URLSearchParams(balanceConsultHref("vata").split("?")[1]);
    expect(query.get("utm_medium")).toBe("balance_test");
    expect(query.get("utm_content")).toBe("balance_vata");
    expect(query.get("dosha")).toBeNull();
  });
});
