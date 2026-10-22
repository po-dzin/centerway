import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ captured: [] as string[], runs: [] as unknown[], budgetAllowed: true }));

vi.mock("@/lib/agent/questions/store", () => ({
  captureQuestion: async ({ text }: { text: string }) => {
    calls.captured.push(text);
    return true;
  },
}));
vi.mock("@/lib/agent/runs", () => ({
  guestBudgetKey: (value: string) => `key:${value}`,
  resolveBudget: async () =>
    calls.budgetAllowed
      ? { allowed: true, remaining: 1 }
      : { allowed: false, reason: "subject_daily", spent: 1, limit: 1 },
  startAgentRun: async (input: unknown) => {
    calls.runs.push(input);
    return "run-1";
  },
  recordAgentMessage: async () => undefined,
  finishAgentRun: async () => undefined,
}));
vi.mock("@/lib/telegram/tg", () => ({
  callTelegramBotApi: async () => null,
  escapeTelegramHtml: (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
}));

import { buildIndex } from "@/lib/agent/knowledge/search";
import type { KnowledgeDoc } from "@/lib/agent/knowledge/types";
import type { ModelCall } from "@/lib/agent/model";
import { kbCopy } from "./answer";
import { answerKbQuestion, isTeamChat } from "./server";

const index = buildIndex([
  {
    id: "support:payment",
    kind: "support",
    title: "Оплата частинами",
    href: "/pay",
    text: "Оплатити програму можна частинами через LiqPay.",
    locale: "uk",
    audience: "public",
    source: "test",
    updatedAt: null,
  } as unknown as KnowledgeDoc,
]);

const fakeModel: ModelCall = async () => ({
  text: "Так, частинами через LiqPay [1].",
  inputTokens: 10,
  outputTokens: 5,
});

beforeEach(() => {
  calls.captured = [];
  calls.runs = [];
  calls.budgetAllowed = true;
});

describe("kb bot — the order of the contract", () => {
  it("hands a health question to a person before searching or calling a model", async () => {
    const model = vi.fn(fakeModel);
    const result = await answerKbQuestion({
      question: "Чи можна мені це при вагітності?",
      telegramUserId: 1,
      index,
      call: model,
    });
    expect(result.outcome).toBe("handoff");
    expect(model).not.toHaveBeenCalled();
  });

  it("captures a question nothing answers, with no model call", async () => {
    const model = vi.fn(fakeModel);
    const result = await answerKbQuestion({
      question: "Який розклад трамваїв?",
      telegramUserId: 1,
      index,
      call: model,
    });
    expect(result).toEqual({ outcome: "no_sources", html: kbCopy.noSources });
    expect(calls.captured).toEqual(["Який розклад трамваїв?"]);
    expect(model).not.toHaveBeenCalled();
  });

  it("answers from the corpus with a link we built, logged as the kb model", async () => {
    const result = await answerKbQuestion({
      question: "Як оплатити частинами?",
      telegramUserId: 7,
      index,
      call: fakeModel,
    });
    expect(result.outcome).toBe("answered");
    expect(result.html).toContain('<a href="https://www.centerway.net.ua/pay">Оплата частинами</a>');
    expect(calls.runs).toEqual([
      { contour: "assistant", userId: null, guestKey: "key:tg:7", model: "openai/gpt-6.1-sol" },
    ]);
  });

  it("captures the question when the model says the sources do not know", async () => {
    const result = await answerKbQuestion({
      question: "Як оплатити частинами в подарунок?",
      telegramUserId: 7,
      index,
      call: async () => ({ text: "У джерелах цього немає.", inputTokens: 10, outputTokens: 5 }),
    });
    expect(result).toEqual({ outcome: "unanswered", html: "У джерелах цього немає." });
    expect(calls.captured).toEqual(["Як оплатити частинами в подарунок?"]);
  });

  it("says the limit is reached instead of calling the model", async () => {
    calls.budgetAllowed = false;
    const model = vi.fn(fakeModel);
    const result = await answerKbQuestion({
      question: "Як оплатити частинами?",
      telegramUserId: 7,
      index,
      call: model,
    });
    expect(result).toEqual({ outcome: "budget", html: kbCopy.budget });
    expect(model).not.toHaveBeenCalled();
  });

  it("says try again when the model fails", async () => {
    const result = await answerKbQuestion({
      question: "Як оплатити частинами?",
      telegramUserId: 7,
      index,
      call: async () => {
        throw new Error("timeout");
      },
    });
    expect(result).toEqual({ outcome: "failed", html: kbCopy.failed });
  });
});

describe("kb bot — where it speaks", () => {
  it("recognises the work group with or without the -100 prefix", () => {
    vi.stubEnv("SUPPORT_CHAT_ID", "-1001234567");
    expect(isTeamChat(-1001234567)).toBe(true);
    expect(isTeamChat("1234567")).toBe(true);
    expect(isTeamChat(-1009999999)).toBe(false);
    vi.unstubAllEnvs();
  });

  it("is nowhere when the work group is not configured", () => {
    vi.stubEnv("SUPPORT_CHAT_ID", "");
    expect(isTeamChat(-1001234567)).toBe(false);
    vi.unstubAllEnvs();
  });
});
