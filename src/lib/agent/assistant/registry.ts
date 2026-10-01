/**
 * The assistant's (A2) tool registry — CLOSED, and this file is the closing.
 *
 * docs/agent-contour-2026-08-21.md §7: the registry is a list, not a set of
 * examples, because the most successful prompt injection in the world still
 * ends at a function that does not exist. The chat endpoint exposes
 * `assistantToolsFor(audience)` and nothing else; a tool that is not named
 * here cannot be reached from a conversation however the model asks for it.
 *
 * READ-ONLY STEP (§10 step 1, 2026-10-01). Every tool below reads, and the
 * registry test fails the day one of them is declared as writing. The two
 * writes A2 will get (`consult.request`, `support.handoff`) arrive in step 3,
 * each behind a human confirmation, and get added here — not in a prompt.
 *
 * NO MODEL HERE. The definitions are plain zod and plain functions so the
 * gates in §9 run as unit tests; the endpoint adapts them to the AI SDK's
 * `tool()` at the edge, in one place.
 */

import { z } from "zod";

/**
 * Who the assistant is talking to. Decided by the server from the session,
 * never by the model and never by the request body: a prompt can claim to be a
 * learner; `auth.uid()` cannot (§2, invariant 2).
 */
export type AssistantAudience = "guest" | "learner";

export type AssistantToolName = "knowledge.search" | "catalog.courses" | "course.outline" | "tests.list";

export type AssistantToolSpec = {
  name: AssistantToolName;
  /** For the model. Ukrainian, like the interface — the model answers in the asker's language anyway. */
  description: string;
  input: z.ZodType;
  /** Which audiences see the tool. A guest tool is also a learner tool; the reverse never holds. */
  audiences: readonly AssistantAudience[];
  /** Always false in this step; the registry test holds it there. */
  writes: false;
};

const BOTH = ["guest", "learner"] as const;

export const ASSISTANT_TOOLS: readonly AssistantToolSpec[] = [
  {
    name: "knowledge.search",
    description:
      "Пошук у базі знань CenterWay: продукти, ціни, курси (вітрина, не уроки), тести, відповіді підтримки, оферта. Повертає документи з посиланнями. Питання про здоровʼя не шукає — повертає межу і передачу людині.",
    input: z.object({ query: z.string().trim().min(1).max(500) }),
    audiences: BOTH,
    writes: false,
  },
  {
    name: "catalog.courses",
    description: "Курси, які зараз є в каталозі: назва, для чого, посилання на сторінку курсу.",
    input: z.object({}),
    audiences: BOTH,
    writes: false,
  },
  {
    name: "course.outline",
    description:
      "Будова одного курсу: модулі, назви уроків, тривалість, розклад. Без змісту уроків — зміст відкривається тільки в кабінеті.",
    input: z.object({ slug: z.string().trim().min(1).max(120) }),
    audiences: BOTH,
    writes: false,
  },
  {
    name: "tests.list",
    description: "Тести платформи: що кожен читає, скільки триває, де пройти. Результат тесту не тлумачить.",
    input: z.object({}),
    audiences: BOTH,
    writes: false,
  },
];

export function assistantToolsFor(audience: AssistantAudience): AssistantToolSpec[] {
  return ASSISTANT_TOOLS.filter((tool) => tool.audiences.includes(audience));
}
