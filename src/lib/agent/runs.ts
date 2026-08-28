/**
 * Writing the agent contour's log, and reading the day's spend out of it.
 *
 * The ONLY writer of `agent_runs` / `agent_messages`. Both tables have read
 * policies and no write policies at all, so this module holding the service
 * role is not a convenience — it is the mechanism (see the migration header).
 *
 * There is no model call anywhere in here. The log and the budget are the
 * scaffolding an agent gets built inside, and they were written first on
 * purpose: a contour that starts talking before it can account for itself has
 * no way to answer either of the two questions it will certainly be asked —
 * "what did it do to my course?" and "why is the invoice that size?".
 */

import { createHash } from "node:crypto";

import { adminClient } from "@/lib/auth/adminClient";
import { budgetDayStart, budgetVerdict, type BudgetSubject, type BudgetVerdict } from "./budget";

export type AgentContour = "builder" | "assistant";
export type AgentRunStatus = "running" | "completed" | "failed" | "refused" | "aborted";
export type AgentMessageRole = "user" | "assistant" | "tool";

export type StartRunInput = {
  contour: AgentContour;
  /** NULL for a signed-out visitor talking to the assistant. */
  userId: string | null;
  /** For that visitor: `guestBudgetKey(ip)`, never the address itself. */
  guestKey?: string | null;
  courseId?: string | null;
  model?: string | null;
};

/**
 * The budget key for a signed-out visitor.
 *
 * Salted with a server secret so the stored value cannot be matched back to a
 * known address by anyone reading the table. With no secret configured the key
 * is still stable within the deploy — a weaker guarantee, and the log says so
 * rather than silently counting every guest as one.
 */
export function guestBudgetKey(ip: string): string {
  const secret = process.env.AGENT_GUEST_KEY_SECRET ?? "";
  if (!secret) console.warn("[agent] AGENT_GUEST_KEY_SECRET unset — guest budget keys are unsalted");
  return createHash("sha256").update(`${secret}:${ip}`).digest("hex");
}

export async function startAgentRun(input: StartRunInput): Promise<string> {
  const { data, error } = await adminClient()
    .from("agent_runs")
    .insert({
      contour: input.contour,
      user_id: input.userId,
      guest_key: input.userId ? null : (input.guestKey ?? null),
      course_id: input.courseId ?? null,
      model: input.model ?? null,
      status: "running",
    })
    .select("id")
    .single();
  if (error) throw new Error(`agent_run_start_failed:${error.message}`);
  return (data as { id: string }).id;
}

export type AgentMessageInput = {
  runId: string;
  /** Turn order within the run — explicit, because two tool calls share a millisecond. */
  seq: number;
  role: AgentMessageRole;
  content?: string | null;
  toolName?: string | null;
  toolArgs?: unknown;
  /** The outcome code, e.g. "ok" or "course_not_found". Never a stack trace. */
  toolResult?: string | null;
};

/**
 * Records one turn.
 *
 * Never throws into the caller's path: a log write that fails must not abort a
 * tool that already ran. The reverse — a successful mutation with no record of
 * it — is the case the retention and the revision history exist to cover, and
 * losing the answer to "what happened" is still better than tearing down a
 * session the author is in the middle of.
 */
export async function recordAgentMessage(input: AgentMessageInput): Promise<void> {
  const { error } = await adminClient().from("agent_messages").insert({
    run_id: input.runId,
    seq: input.seq,
    role: input.role,
    content: input.content ?? null,
    tool_name: input.toolName ?? null,
    tool_args: input.toolArgs === undefined ? null : input.toolArgs,
    tool_result: input.toolResult ?? null,
  });
  if (error) console.error("[agent] message log failed:", error.message);
}

export async function finishAgentRun(input: {
  runId: string;
  status: Exclude<AgentRunStatus, "running">;
  inputTokens?: number;
  outputTokens?: number;
  error?: string | null;
}): Promise<void> {
  const { error } = await adminClient()
    .from("agent_runs")
    .update({
      status: input.status,
      input_tokens: Math.max(0, Math.round(input.inputTokens ?? 0)),
      output_tokens: Math.max(0, Math.round(input.outputTokens ?? 0)),
      error: input.error ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", input.runId);
  if (error) console.error("[agent] run finish failed:", error.message);
}

/**
 * Tokens spent since a moment — by one account, or by everyone.
 *
 * Summed in TypeScript rather than in SQL. At this scale a day is tens of rows
 * and an RPC would be a second place to keep a definition of "spend"; if the
 * project ever reaches the point where this scan is felt, the honest fix is a
 * materialised daily total, not a cleverer query here.
 */
async function tokensSince(since: string, subject?: { userId?: string | null; guestKey?: string | null }): Promise<number> {
  let query = adminClient().from("agent_runs").select("input_tokens, output_tokens").gte("started_at", since);
  if (subject?.userId) query = query.eq("user_id", subject.userId);
  else if (subject?.guestKey) query = query.eq("guest_key", subject.guestKey);

  const { data, error } = await query;
  if (error) {
    // FAIL CLOSED, unlike the rate limiter. A limiter that breaks costs us a
    // refused click; a budget that breaks costs money at a rate nobody is
    // watching. Reporting the ceiling as reached is the safe direction.
    console.error("[agent] budget read failed, refusing:", error.message);
    return Number.POSITIVE_INFINITY;
  }

  return (data ?? []).reduce((total: number, row: Record<string, unknown>) => {
    return total + Number(row.input_tokens ?? 0) + Number(row.output_tokens ?? 0);
  }, 0);
}

/** The whole budget question, answered for one caller at one moment. */
export async function resolveBudget(input: {
  subject: BudgetSubject;
  userId: string | null;
  /** Required when `userId` is null, or the guest tier counts nothing. */
  guestKey?: string | null;
  now?: Date;
}): Promise<BudgetVerdict> {
  const since = budgetDayStart(input.now ?? new Date());
  const identified = input.userId ?? input.guestKey ?? null;
  const [spentBySubject, spentByPlatform] = await Promise.all([
    identified
      ? tokensSince(since, { userId: input.userId, guestKey: input.guestKey })
      : // An unidentified caller cannot be budgeted, so it is not served. The
        // alternative — count it as zero — is an unlimited tier reachable by
        // sending no identity at all.
        Promise.resolve(Number.POSITIVE_INFINITY),
    tokensSince(since),
  ]);
  return budgetVerdict({ subject: input.subject, spentBySubject, spentByPlatform });
}
