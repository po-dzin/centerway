/**
 * One comment in, at most one answer out.
 *
 * The order of the guards is the point of this file. A comment is CLAIMED
 * first (the unique comment id makes Meta's repeated deliveries harmless),
 * then it is refused if it is too old to answer, if this person already got
 * this rule's message, or if the hour's cap is spent. Only then does a message
 * leave. Whatever happens is written to the event row, so the admin journal
 * can say why a comment was not answered.
 */

import { log } from "@/lib/logger";

import { pickVariant, matchesKeyword } from "./match";
import { REPLY_WINDOW_SECONDS, type CommentEvent, type InstagramSender } from "./instagram";

export type AutoreplyRule = {
  id: string;
  name: string;
  mediaId: string | null;
  keywords: string[];
  publicReplies: string[];
  dmTexts: string[];
  buttonLabel: string | null;
  buttonUrl: string | null;
  utmCampaign: string | null;
  enabled: boolean;
  maxPerHour: number;
};

export type EventStatus = "sent" | "failed" | "skipped_duplicate" | "skipped_old" | "skipped_rate";

export interface AutoreplyStore {
  listEnabledRules(): Promise<AutoreplyRule[]>;
  /** Records the comment as being handled; null when this comment was already handled. */
  claimComment(ruleId: string, event: CommentEvent): Promise<string | null>;
  hasSentTo(ruleId: string, igUserId: string): Promise<boolean>;
  countSentSince(ruleId: string, sinceIso: string): Promise<number>;
  finish(eventId: string, status: EventStatus, error?: string): Promise<void>;
}

export type HandleResult =
  | { outcome: "no_rule" }
  | { outcome: "already_handled" }
  | { outcome: EventStatus; ruleId: string };

export type HandleDeps = {
  store: AutoreplyStore;
  sender: InstagramSender | null;
  siteOrigin: string;
  now?: () => number;
  random?: () => number;
};

const SLUG = /[^a-z0-9]+/g;

/** The button link with the Instagram tags every auto-reply carries, absolute. */
export function buildLink(url: string, rule: Pick<AutoreplyRule, "name" | "utmCampaign">, siteOrigin: string): string {
  const link = new URL(url, siteOrigin);
  const campaign = (rule.utmCampaign || rule.name).toLowerCase().replace(SLUG, "-").replace(/^-|-$/g, "");
  link.searchParams.set("utm_source", "instagram");
  link.searchParams.set("utm_medium", "autodm");
  if (campaign) link.searchParams.set("utm_campaign", campaign);
  return link.toString();
}

/** The direct message: the chosen text, then the link on its own lines. */
export function composeDirectMessage(text: string, rule: AutoreplyRule, siteOrigin: string): string {
  if (!rule.buttonUrl) return text;
  const link = buildLink(rule.buttonUrl, rule, siteOrigin);
  return `${text}\n\n${rule.buttonLabel ? `${rule.buttonLabel}: ` : ""}${link}`;
}

export async function handleComment(event: CommentEvent, deps: HandleDeps): Promise<HandleResult> {
  const { store, sender, siteOrigin } = deps;
  const now = deps.now ?? Date.now;
  const random = deps.random ?? Math.random;

  const rules = await store.listEnabledRules();
  const rule = rules.find(
    (candidate) =>
      (candidate.mediaId === null || candidate.mediaId === event.mediaId) &&
      matchesKeyword(event.text, candidate.keywords),
  );
  if (!rule) return { outcome: "no_rule" };

  const eventId = await store.claimComment(rule.id, event);
  if (!eventId) return { outcome: "already_handled" };

  const stop = async (status: EventStatus, error?: string): Promise<HandleResult> => {
    await store.finish(eventId, status, error);
    return { outcome: status, ruleId: rule.id };
  };

  if (event.time !== null && now() / 1000 - event.time > REPLY_WINDOW_SECONDS) return stop("skipped_old");
  if (event.fromId && (await store.hasSentTo(rule.id, event.fromId))) return stop("skipped_duplicate");
  const sinceIso = new Date(now() - 60 * 60 * 1000).toISOString();
  if ((await store.countSentSince(rule.id, sinceIso)) >= rule.maxPerHour) return stop("skipped_rate");
  if (!sender) return stop("failed", "instagram_not_configured");

  const text = pickVariant(rule.dmTexts, random);
  if (!text) return stop("failed", "no_dm_text");

  try {
    await sender.sendPrivateReply(event.commentId, composeDirectMessage(text, rule, siteOrigin));
  } catch (error) {
    return stop("failed", error instanceof Error ? error.message.slice(0, 300) : "send_failed");
  }

  // The public line is a courtesy: the message has already left, so a refusal
  // here is logged and does not turn a delivered reply into a failed one.
  const publicText = pickVariant(rule.publicReplies, random);
  if (publicText) {
    try {
      await sender.replyPublicly(event.commentId, publicText);
    } catch (error) {
      log.warn("autoreply.public_reply_failed", { ruleId: rule.id, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return stop("sent");
}
