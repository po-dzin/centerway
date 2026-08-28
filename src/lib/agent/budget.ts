/**
 * How much the agent contour is allowed to spend, and on whose behalf.
 *
 * PURE. No database, no clock, no Next — the numbers and the decision only, so
 * the policy can be read, argued with and tested without standing a server up.
 * The counting lives in `runs.ts`, which asks `agent_runs` and hands the totals
 * to `budgetVerdict`.
 *
 * WHY A SECOND CEILING WHEN RATE LIMITS EXIST. A rate limit bounds how OFTEN
 * someone calls; it says nothing about cost. One request that feeds a
 * 200-page source document to a strong model costs more than a thousand short
 * assistant answers, and the request-per-minute rule cannot tell them apart.
 * Tokens are the unit we are actually billed in, so tokens are the unit with a
 * ceiling (docs/agent-contour-2026-08-21.md §8).
 *
 * WHY IT FAILS LOUD RATHER THAN QUIETLY DEGRADING. When the ceiling is reached
 * the contour says so and hands over to a person. Silently switching to a
 * cheaper model, or truncating what the agent may read, produces an assistant
 * that is wrong in ways nobody can see — and for a platform whose subject is
 * somebody's body, an answer that got quietly worse is the failure mode we
 * least want.
 */

/** Who is asking, in the only three shapes the contour has. */
export type BudgetSubject = "guest" | "learner" | "author";

/**
 * Daily ceilings, in total tokens (input + output).
 *
 * The shape of the numbers is deliberate: a guest is a stranger on a public
 * page whose whole use is a handful of questions about a product; a learner is
 * a paying person whose questions are worth answering generously; an author is
 * feeding whole documents into a structuring pass and legitimately costs an
 * order of magnitude more.
 */
export const DAILY_TOKEN_LIMIT: Record<BudgetSubject, number> = {
  guest: 20_000,
  learner: 200_000,
  author: 2_000_000,
};

/**
 * The project-wide ceiling for a day.
 *
 * Not the sum of the per-person ones, and not meant to be reachable in normal
 * use: this is the number that stops a bad day from becoming a bad invoice —
 * a loop, a leaked key, a crawler that found the assistant.
 */
export const DAILY_TOKEN_LIMIT_PLATFORM = 10_000_000;

export type BudgetVerdict =
  | { allowed: true; remaining: number }
  | { allowed: false; reason: "subject_daily" | "platform_daily"; spent: number; limit: number };

export function budgetVerdict(input: {
  subject: BudgetSubject;
  /** Tokens this subject has already spent in the current day. */
  spentBySubject: number;
  /** Tokens the whole platform has spent in the current day. */
  spentByPlatform: number;
}): BudgetVerdict {
  // The platform ceiling is checked FIRST: when it is reached, whose request
  // this is stops mattering, and telling an author they have budget left when
  // the project does not would be a lie with a bill attached.
  if (input.spentByPlatform >= DAILY_TOKEN_LIMIT_PLATFORM) {
    return {
      allowed: false,
      reason: "platform_daily",
      spent: input.spentByPlatform,
      limit: DAILY_TOKEN_LIMIT_PLATFORM,
    };
  }

  const limit = DAILY_TOKEN_LIMIT[input.subject];
  if (input.spentBySubject >= limit) {
    return { allowed: false, reason: "subject_daily", spent: input.spentBySubject, limit };
  }

  return { allowed: true, remaining: limit - input.spentBySubject };
}

/**
 * The start of the budget day, as an ISO string.
 *
 * Kyiv, not UTC. The ceiling resets when the people using this platform
 * experience a new day — a limit that resets at 03:00 local is a limit that
 * looks broken to everyone who hits it in the evening.
 */
export function budgetDayStart(now: Date): string {
  const kyiv = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Kyiv" }));
  const offset = now.getTime() - kyiv.getTime();
  kyiv.setHours(0, 0, 0, 0);
  return new Date(kyiv.getTime() + offset).toISOString();
}
