/** The auto-reply tables, behind the interface the engine reads. Service role only. */

import { serviceClient } from "@/lib/db/server";

import { addCustomerTags } from "@/lib/platform/customerTags";

import { campaignOf, type AutoreplyRule, type AutoreplyStore, type EventStatus } from "./engine";
import type { CommentEvent } from "./instagram";

type Db = ReturnType<typeof serviceClient>;

export type RuleRow = {
  id: string;
  name: string;
  channel: string;
  media_id: string | null;
  keywords: string[];
  public_replies: string[];
  dm_texts: string[];
  button_label: string | null;
  button_url: string | null;
  utm_campaign: string | null;
  open_button_label: string | null;
  follow_up_text: string | null;
  enabled: boolean;
  max_per_hour: number;
  created_at: string;
  updated_at: string;
};

export const RULE_COLUMNS =
  "id, name, channel, media_id, keywords, public_replies, dm_texts, button_label, button_url, utm_campaign, open_button_label, follow_up_text, enabled, max_per_hour, created_at, updated_at";

export function toRule(row: RuleRow): AutoreplyRule {
  return {
    id: row.id,
    name: row.name,
    mediaId: row.media_id,
    keywords: row.keywords ?? [],
    publicReplies: row.public_replies ?? [],
    dmTexts: row.dm_texts ?? [],
    buttonLabel: row.button_label,
    buttonUrl: row.button_url,
    utmCampaign: row.utm_campaign,
    openButtonLabel: row.open_button_label,
    followUpText: row.follow_up_text,
    enabled: row.enabled,
    maxPerHour: row.max_per_hour,
  };
}

const UNIQUE_VIOLATION = "23505";

export function dbStore(db: Db = serviceClient()): AutoreplyStore {
  return {
    async listEnabledRules() {
      const { data, error } = await db
        .from("autoreply_rules")
        .select(RULE_COLUMNS)
        .eq("channel", "instagram")
        .eq("enabled", true)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return ((data ?? []) as RuleRow[]).map(toRule);
    },

    async claimComment(ruleId: string, event: CommentEvent) {
      const { data, error } = await db
        .from("autoreply_events")
        .insert({
          rule_id: ruleId,
          comment_id: event.commentId,
          ig_user_id: event.fromId,
          ig_username: event.fromUsername,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) {
        if (error.code === UNIQUE_VIOLATION) return null;
        throw new Error(error.message);
      }
      return (data as { id: string }).id;
    },

    async hasEarlierClaim(ruleId: string, igUserId: string, eventId: string) {
      const { data, error } = await db
        .from("autoreply_events")
        .select("id, created_at")
        .eq("rule_id", ruleId)
        .eq("ig_user_id", igUserId)
        .in("status", ["pending", "sent"]);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as { id: string; created_at: string }[];
      const mine = rows.find((row) => row.id === eventId);
      if (!mine) return false;
      return rows.some(
        (row) =>
          row.id !== eventId &&
          (row.created_at < mine.created_at || (row.created_at === mine.created_at && row.id < mine.id)),
      );
    },

    async countClaimsSince(ruleId: string, sinceIso: string) {
      const { count, error } = await db
        .from("autoreply_events")
        .select("id", { count: "exact", head: true })
        .eq("rule_id", ruleId)
        .in("status", ["pending", "sent"])
        .gte("created_at", sinceIso);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },

    async finish(eventId: string, status: EventStatus, error?: string) {
      const { error: dbError } = await db
        .from("autoreply_events")
        .update({ status, error: error ?? null })
        .eq("id", eventId);
      // Backstop for the claim ordering: the partial unique index lets only one
      // `sent` per person per rule exist.
      if (dbError && dbError.code === UNIQUE_VIOLATION) {
        await db.from("autoreply_events").update({ status: "skipped_duplicate" }).eq("id", eventId);
        return;
      }
      if (dbError) throw new Error(dbError.message);
    },

    async rememberPerson(rule: AutoreplyRule, event: CommentEvent) {
      if (!event.fromId) return;
      const id = await cardByInstagram(db, rule, event);
      if (id) await addCustomerTags(db, [id], ["ig-autodm"], "autoreply");
    },
  };
}

/**
 * The card of the person behind an Instagram id, made on their first reply.
 * The rule that brought them is their first touch; a card that already exists
 * only gets a fresher nick.
 */
async function cardByInstagram(db: Db, rule: AutoreplyRule, event: CommentEvent): Promise<string | null> {
  const igUserId = event.fromId as string;
  const find = async () => {
    const { data, error } = await db.from("customers").select("id").eq("ig_user_id", igUserId).limit(1);
    if (error) throw new Error(error.message);
    return data?.[0]?.id ?? null;
  };
  const existing = await find();
  if (existing) {
    if (event.fromUsername) {
      const { error } = await db.from("customers").update({ ig_username: event.fromUsername }).eq("id", existing);
      if (error) throw new Error(error.message);
    }
    return existing;
  }
  const { data, error } = await db
    .from("customers")
    .insert({
      ig_user_id: igUserId,
      ig_username: event.fromUsername,
      first_touch: { channel: "instagram", medium: "autodm", campaign: campaignOf(rule), at: new Date().toISOString() },
    })
    .select("id")
    .single();
  if (error) {
    // Two comments from one person at once: the other request made the card.
    if (error.code === UNIQUE_VIOLATION) return find();
    throw new Error(error.message);
  }
  return (data as { id: string }).id;
}
