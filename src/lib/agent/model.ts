/**
 * The one place the agent contour talks to a model (2026-10-22).
 *
 * WHICH MODEL. Chosen per job, here and nowhere else, so changing a model is a
 * one-line diff a reviewer can see (G, 16.10):
 *   · kbBot     — the knowledge-base bot in Telegram;
 *   · assistant — the site/library assistant, when it lands;
 *   · builder   — the course builder's structuring pass, when it lands.
 *
 * THROUGH THE GATEWAY. A bare "provider/model" string is resolved by the AI
 * SDK through Vercel AI Gateway. On a Vercel deployment it authenticates with
 * the project's OIDC token on its own; anywhere else (a laptop, the cloud
 * sessions) it reads AI_GATEWAY_API_KEY. No provider key lives in this repo.
 *
 * IN ORDER, EVERY TIME: budget → run row → model → log → close the run. A call
 * that cannot be accounted for is not made; a call that was made is accounted
 * for even when it fails (docs/agent-contour-2026-08-21.md §8).
 */

import { generateText } from "ai";

import type { BudgetSubject } from "./budget";
import { finishAgentRun, recordAgentMessage, resolveBudget, startAgentRun, type AgentContour } from "./runs";

export const AGENT_MODELS = {
  kbBot: "openai/gpt-6.1-sol",
  assistant: "anthropic/claude-haiku-5.5",
  builder: "anthropic/claude-opus-5.5",
} as const;

export type AgentRole = keyof typeof AGENT_MODELS;

/** A Telegram webhook waits on this; past it the person is better served by "try again". */
const MODEL_TIMEOUT_MS = 25_000;

export type ModelCall = (input: {
  model: string;
  system: string;
  prompt: string;
  maxOutputTokens: number;
}) => Promise<{ text: string; inputTokens: number; outputTokens: number }>;

const gatewayCall: ModelCall = async (input) => {
  const result = await generateText({
    model: input.model,
    system: input.system,
    prompt: input.prompt,
    maxOutputTokens: input.maxOutputTokens,
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
  });
  return {
    text: result.text,
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
  };
};

export type AgentModelResult =
  | { ok: true; text: string; runId: string; model: string }
  | { ok: false; reason: "budget" | "model_failed"; runId: string | null };

export async function runAgentModel(input: {
  role: AgentRole;
  contour: AgentContour;
  subject: BudgetSubject;
  userId: string | null;
  guestKey?: string | null;
  system: string;
  prompt: string;
  maxOutputTokens?: number;
  /** Tests pass a fake; production always goes through the gateway. */
  call?: ModelCall;
}): Promise<AgentModelResult> {
  const budget = await resolveBudget({ subject: input.subject, userId: input.userId, guestKey: input.guestKey });
  if (!budget.allowed) return { ok: false, reason: "budget", runId: null };

  const model = AGENT_MODELS[input.role];
  const runId = await startAgentRun({
    contour: input.contour,
    userId: input.userId,
    guestKey: input.guestKey ?? null,
    model,
  });
  await recordAgentMessage({ runId, seq: 0, role: "user", content: input.prompt });

  try {
    const reply = await (input.call ?? gatewayCall)({
      model,
      system: input.system,
      prompt: input.prompt,
      maxOutputTokens: input.maxOutputTokens ?? 600,
    });
    await recordAgentMessage({ runId, seq: 1, role: "assistant", content: reply.text });
    await finishAgentRun({
      runId,
      status: "completed",
      inputTokens: reply.inputTokens,
      outputTokens: reply.outputTokens,
    });
    return { ok: true, text: reply.text, runId, model };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[agent] model call failed:", message);
    // The gateway bills a call that timed out mid-answer, so the run closes as
    // failed with no tokens rather than staying "running" forever: the spend
    // the log cannot know about is the gateway dashboard's to show.
    await finishAgentRun({ runId, status: "failed", error: message.slice(0, 500) });
    return { ok: false, reason: "model_failed", runId };
  }
}
