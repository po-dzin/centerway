/**
 * The rules as the admin edits them: validation, CRUD and the numbers beside
 * each rule. Reading is staff; writing is the owner's (see the routes).
 */

import { serviceClient } from "@/lib/db/server";

import { cleanVariants, normalizeKeywords } from "./match";
import { RULE_COLUMNS, type RuleRow } from "./store";

type Db = ReturnType<typeof serviceClient>;

export class AutoreplyError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = "AutoreplyError";
  }
}

export type RuleInput = {
  name?: unknown;
  mediaId?: unknown;
  keywords?: unknown;
  publicReplies?: unknown;
  dmTexts?: unknown;
  buttonLabel?: unknown;
  buttonUrl?: unknown;
  utmCampaign?: unknown;
  enabled?: unknown;
  maxPerHour?: unknown;
};

const DM_MAX = 1000;
const PUBLIC_MAX = 500;

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed === "" ? null : trimmed;
}

/** A link the message may carry: a path on this site or an https address. */
function link(value: unknown): string | null {
  const raw = text(value, 500);
  if (!raw) return null;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    return new URL(raw).protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}

/** The columns an input sets. Only keys present in the input are written, so a PATCH leaves the rest alone. */
export function rulePatch(input: RuleInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if ("name" in input) patch.name = text(input.name, 120) ?? "";
  if ("mediaId" in input) patch.media_id = text(input.mediaId, 64);
  if ("keywords" in input) patch.keywords = normalizeKeywords(input.keywords).slice(0, 20);
  if ("publicReplies" in input) patch.public_replies = cleanVariants(input.publicReplies, PUBLIC_MAX);
  if ("dmTexts" in input) patch.dm_texts = cleanVariants(input.dmTexts, DM_MAX);
  if ("buttonLabel" in input) patch.button_label = text(input.buttonLabel, 40);
  if ("buttonUrl" in input) patch.button_url = link(input.buttonUrl);
  if ("utmCampaign" in input) patch.utm_campaign = text(input.utmCampaign, 60);
  if ("enabled" in input) patch.enabled = input.enabled === true;
  if ("maxPerHour" in input) {
    const n = Number(input.maxPerHour);
    patch.max_per_hour = Number.isFinite(n) ? Math.min(750, Math.max(1, Math.round(n))) : 200;
  }
  return patch;
}

/** A rule may be turned on only when it can actually answer something. */
export function assertCanEnable(row: Pick<RuleRow, "keywords" | "dm_texts">): void {
  if (row.keywords.length === 0) throw new AutoreplyError("rule_needs_keywords", 422);
  if (row.dm_texts.length === 0) throw new AutoreplyError("rule_needs_message", 422);
}

export type RuleStats = { comments: number; sent: number; failed: number; skipped: number };
export type RuleSummary = RuleRow & { stats: RuleStats };

export async function listRules(db: Db = serviceClient()): Promise<RuleSummary[]> {
  const { data, error } = await db
    .from("autoreply_rules")
    .select(RULE_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw new AutoreplyError(error.message, 500);
  const rules = (data ?? []) as RuleRow[];
  if (rules.length === 0) return [];

  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: events, error: eventsError } = await db
    .from("autoreply_events")
    .select("rule_id, status")
    .in(
      "rule_id",
      rules.map((rule) => rule.id),
    )
    .gte("created_at", since)
    .limit(20000);
  if (eventsError) throw new AutoreplyError(eventsError.message, 500);

  const stats = new Map<string, RuleStats>();
  for (const row of (events ?? []) as { rule_id: string; status: string }[]) {
    const entry = stats.get(row.rule_id) ?? { comments: 0, sent: 0, failed: 0, skipped: 0 };
    entry.comments += 1;
    if (row.status === "sent") entry.sent += 1;
    else if (row.status === "failed") entry.failed += 1;
    else if (row.status.startsWith("skipped")) entry.skipped += 1;
    stats.set(row.rule_id, entry);
  }
  return rules.map((rule) => ({
    ...rule,
    stats: stats.get(rule.id) ?? { comments: 0, sent: 0, failed: 0, skipped: 0 },
  }));
}

export async function createRule(actorId: string, input: RuleInput, db: Db = serviceClient()): Promise<RuleRow> {
  const patch = rulePatch({ ...input, enabled: false });
  const { data, error } = await db
    .from("autoreply_rules")
    .insert({ channel: "instagram", created_by: actorId, ...patch })
    .select(RULE_COLUMNS)
    .single();
  if (error) throw new AutoreplyError(error.message, 500);
  return data as RuleRow;
}

export async function updateRule(id: string, input: RuleInput, db: Db = serviceClient()): Promise<RuleRow> {
  const patch = rulePatch(input);
  const { data: current, error: readError } = await db
    .from("autoreply_rules")
    .select(RULE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (readError) throw new AutoreplyError(readError.message, 500);
  if (!current) throw new AutoreplyError("rule_not_found", 404);

  const merged = { ...(current as RuleRow), ...patch } as RuleRow;
  if (merged.enabled) assertCanEnable(merged);

  const { data, error } = await db
    .from("autoreply_rules")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(RULE_COLUMNS)
    .single();
  if (error) throw new AutoreplyError(error.message, 500);
  return data as RuleRow;
}

export async function deleteRule(id: string, db: Db = serviceClient()): Promise<void> {
  const { error } = await db.from("autoreply_rules").delete().eq("id", id);
  if (error) throw new AutoreplyError(error.message, 500);
}

export type EventRow = {
  id: string;
  rule_id: string;
  ig_username: string | null;
  status: string;
  error: string | null;
  created_at: string;
};

export async function listEvents(ruleId: string, db: Db = serviceClient()): Promise<EventRow[]> {
  const { data, error } = await db
    .from("autoreply_events")
    .select("id, rule_id, ig_username, status, error, created_at")
    .eq("rule_id", ruleId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new AutoreplyError(error.message, 500);
  return (data ?? []) as EventRow[];
}
