/**
 * The knowledge-base bot, end to end (2026-10-22). Server-only.
 *
 * WAVE 1: ONLY THE TEAM'S WORK GROUP (`SUPPORT_CHAT_ID`). The team asks it
 * questions a learner would ask, and reads the answers before anyone outside
 * does. Stream groups come in the next wave, with a copy of every answer to
 * this group; until then the group IS the mirror.
 *
 * THE ORDER IS THE CONTRACT (docs/agent-contour-2026-08-21.md):
 *   1. the health boundary, before retrieval and before the model — a question
 *      about one person's body gets a handoff, never an answer;
 *   2. retrieval over the closed corpus — nothing found, no model call; the
 *      question is captured so the corpus can grow where it is thin;
 *   3. the model, behind the budget, logged in agent_runs. An answer that
 *      cites nothing is the model saying the sources did not know, and its
 *      question is captured the same way.
 *
 * `AGENT_KB_BOT=off` turns it off without a deploy of code.
 */

import { callTelegramBotApi } from "@/lib/telegram/tg";
import { needsHumanHandoff } from "@/lib/agent/knowledge/boundaries";
import { search, type KnowledgeIndex } from "@/lib/agent/knowledge/search";
import { captureQuestion } from "@/lib/agent/questions/store";
import { guestBudgetKey } from "@/lib/agent/runs";
import { runAgentModel, type ModelCall } from "@/lib/agent/model";
import { buildKbPrompt, citedSources, formatKbAnswerHtml, KB_SOURCE_LIMIT, KB_SYSTEM_PROMPT, kbCopy } from "./answer";

export function kbBotEnabled(): boolean {
  return process.env.AGENT_KB_BOT?.trim().toLowerCase() !== "off";
}

/** Is this the team's work group? Telegram writes a supergroup id with or without -100. */
export function isTeamChat(chatId: number | string): boolean {
  const team = process.env.SUPPORT_CHAT_ID?.trim();
  if (!team) return false;
  const norm = (value: string) => value.replace(/^-?(100)?/, "");
  return norm(String(chatId)) === norm(team);
}

export type KbOutcome = "answered" | "unanswered" | "handoff" | "no_sources" | "budget" | "failed" | "empty";

export async function answerKbQuestion(input: {
  question: string;
  telegramUserId: number;
  index: KnowledgeIndex;
  call?: ModelCall;
}): Promise<{ outcome: KbOutcome; html: string }> {
  const question = input.question.trim();
  if (!question) return { outcome: "empty", html: kbCopy.emptyQuestion };

  if (needsHumanHandoff(question).escalate) return { outcome: "handoff", html: kbCopy.handoff };

  // The team group reads everything a learner may read; lesson bodies are not
  // in the corpus at all, so "learner" here widens nothing that matters.
  const hits = search(input.index, question, { limit: KB_SOURCE_LIMIT, audience: "learner" });
  if (hits.length === 0) {
    await captureQuestion({ text: question, source: "assistant" });
    return { outcome: "no_sources", html: kbCopy.noSources };
  }

  // A Telegram person is not an account, so the budget counts them by a salted
  // key of their Telegram id, at the learner's ceiling: these are the team's
  // own questions and a stingy limit would only hide what the bot can do.
  const result = await runAgentModel({
    role: "kbBot",
    contour: "assistant",
    subject: "learner",
    userId: null,
    guestKey: guestBudgetKey(`tg:${input.telegramUserId}`),
    system: KB_SYSTEM_PROMPT,
    prompt: buildKbPrompt(question, hits),
    call: input.call,
  });

  if (!result.ok) {
    const outcome = result.reason === "budget" ? "budget" : "failed";
    return { outcome, html: kbCopy[outcome] };
  }
  if (citedSources(result.text).size === 0) {
    await captureQuestion({ text: question, source: "assistant" });
    return { outcome: "unanswered", html: formatKbAnswerHtml(result.text, hits) };
  }
  return { outcome: "answered", html: formatKbAnswerHtml(result.text, hits) };
}

/** Sends the answer as a reply to the question, in the same forum topic. */
export async function sendKbReply(input: {
  chatId: number | string;
  replyTo: number;
  threadId?: number;
  html: string;
}): Promise<void> {
  await callTelegramBotApi("sendMessage", {
    chat_id: input.chatId,
    text: input.html,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_parameters: { message_id: input.replyTo, allow_sending_without_reply: true },
    ...(input.threadId ? { message_thread_id: input.threadId } : {}),
  });
}
