/**
 * Who a broadcast goes to, as data — the shape `broadcast_audience(jsonb)` reads.
 *
 * The rule is evaluated in SQL, once, by the same function for the live count
 * in the editor and for the snapshot taken when sending starts (see the
 * migration 20260915000000_broadcasts.sql). This module only decides what may
 * be STORED as a rule: a body from the browser is parsed into this shape or
 * refused, so the database never sees a kind it does not know and silently
 * matches nobody.
 *
 * Suppression is not expressed here and cannot be switched off from here: the
 * SQL drops every unsubscribed, bounced or complained address last, whatever
 * the rule asked for.
 */

export const AUDIENCE_KINDS = ["buyers", "enrolled", "leads", "registered", "subscribers", "tag"] as const;
export type AudienceKind = (typeof AUDIENCE_KINDS)[number];

export type AudienceRule =
  | { kind: "buyers"; product_codes: string[] }
  | { kind: "enrolled"; course_ids: string[] }
  | { kind: "leads"; product_codes: string[] }
  | { kind: "registered"; opted_in_only: boolean }
  | { kind: "subscribers"; sources: string[] }
  | { kind: "tag"; tags: string[] };

export type Audience = {
  include: AudienceRule[];
  exclude_tags: string[];
  /**
   * Product codes whose paid buyers are left out — "do not invite the people
   * who already came". Read by 20261001000000_broadcast_exclude_buyers.sql; a
   * database without that migration ignores the key, and the count on screen
   * shows it.
   */
  exclude_buyers: string[];
};

export const EMPTY_AUDIENCE: Audience = { include: [], exclude_tags: [], exclude_buyers: [] };

/** Trimmed, de-duplicated, non-empty strings; anything that is not one is dropped. */
function strings(value: unknown, max = 200): string[] {
  if (!Array.isArray(value)) return [];
  const out = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed && trimmed.length <= max) out.add(trimmed);
  }
  return [...out];
}

function isKind(value: unknown): value is AudienceKind {
  return typeof value === "string" && (AUDIENCE_KINDS as readonly string[]).includes(value);
}

/**
 * The rule a request body meant, or null when it is not one.
 *
 * A `tag` rule with no tags is dropped rather than kept: in SQL it matches
 * nobody, and a rule that silently matches nobody is how a launch email goes
 * to a third of the list. Every other kind treats an empty list as "no filter",
 * which is what the SQL does too.
 */
export function parseAudience(input: unknown): Audience | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as { include?: unknown; exclude_tags?: unknown; exclude_buyers?: unknown };
  if (raw.include !== undefined && !Array.isArray(raw.include)) return null;

  const include: AudienceRule[] = [];
  const seen = new Set<string>();
  for (const item of (raw.include as unknown[] | undefined) ?? []) {
    if (!item || typeof item !== "object") return null;
    const rule = item as Record<string, unknown>;
    if (!isKind(rule.kind)) return null;

    let parsed: AudienceRule | null;
    switch (rule.kind) {
      case "buyers":
        parsed = { kind: "buyers", product_codes: strings(rule.product_codes) };
        break;
      case "enrolled":
        parsed = { kind: "enrolled", course_ids: strings(rule.course_ids) };
        break;
      case "leads":
        parsed = { kind: "leads", product_codes: strings(rule.product_codes) };
        break;
      case "registered":
        parsed = { kind: "registered", opted_in_only: rule.opted_in_only === true };
        break;
      case "subscribers":
        parsed = { kind: "subscribers", sources: strings(rule.sources) };
        break;
      case "tag": {
        const tags = strings(rule.tags);
        parsed = tags.length ? { kind: "tag", tags } : null;
        break;
      }
    }
    if (!parsed) continue;
    // One rule of a kind with the same filter is the same rule twice.
    const key = JSON.stringify(parsed);
    if (seen.has(key)) continue;
    seen.add(key);
    include.push(parsed);
  }

  return { include, exclude_tags: strings(raw.exclude_tags), exclude_buyers: strings(raw.exclude_buyers) };
}

/** Read back from the database, where the column defaults to `{"include": []}`. */
export function audienceFromRow(value: unknown): Audience {
  return parseAudience(value) ?? EMPTY_AUDIENCE;
}
